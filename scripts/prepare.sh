#!/usr/bin/env bash
# 팀원 자동 세팅 스크립트
#   - terraform.tfvars 자동 생성 (cognito_domain_prefix + github_repo)
#   - terraform.tfvars 의 github_repo 를 origin 과 맞춤 (ArgoCD repoURL 은 apply 시 application.yaml 에 반영)
#   - .env.local 에 DB 비번 저장 (setup-all.sh 가 자동 source)
#   - GitHub Secret AWS_ACCOUNT_ID 자동 등록 (gh CLI 있을 때)
#
# 사용:  bash scripts/prepare.sh
# 재실행 안전: 값이 이미 채워져 있으면 변경 없이 skip.
#
# DB 비밀번호: .env.local 이 없을 때 아래 중 하나가 이미 셸에 있으면 입력 프롬프트 없이 사용한다.
#   export DB_PASSWORD='...'
#   export TF_VAR_db_password='...'
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# 같은 셸에서 먼저 export 만 한 경우 + 기존 .env.local 반영(있으면)
if [[ -f "$ROOT/.env.local" ]]; then
  # shellcheck disable=SC1091
  source "$ROOT/.env.local"
fi

hr() { printf '==========================================\n'; }
hr; echo " prepare.sh — 팀원 자동 세팅"; hr

# ── 1. 필수 CLI 체크 ──
need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "ERROR: '$1' 미설치. guideREADME.txt [0-A] 참조하여 설치 후 재실행." >&2
    exit 1
  }
}
need aws
need terraform
need git

# ── 2. AWS 자격증명 ──
if ! aws sts get-caller-identity >/dev/null 2>&1; then
  echo "ERROR: AWS 자격증명 없음. 'aws configure' 먼저 실행." >&2
  exit 1
fi
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "AWS 계정: $ACCOUNT_ID"

# ── 3. git origin → owner/repo 자동 추출 ──
ORIGIN_URL=$(git remote get-url origin 2>/dev/null || true)
if [[ -z "$ORIGIN_URL" ]]; then
  echo "ERROR: git remote 'origin' 미설정. 'git clone' 후 이 스크립트를 실행하세요." >&2
  exit 1
fi
# https://github.com/OWNER/REPO(.git) | git@github.com:OWNER/REPO(.git)
OWNER_REPO=$(echo "$ORIGIN_URL" | sed -E 's#(https://github\.com/|git@github\.com:)##; s#\.git$##')
if [[ ! "$OWNER_REPO" =~ ^[^/]+/[^/]+$ ]]; then
  echo "ERROR: git origin URL 해석 실패: $ORIGIN_URL" >&2
  exit 1
fi
echo "GitHub repo: $OWNER_REPO"

# ── 4. terraform.tfvars 생성/갱신 ──
TFVARS="terraform/terraform.tfvars"
TFVARS_EX="terraform/terraform.tfvars.example"
# Cognito 도메인 prefix — 전역 유일 요구. AWS 계정 ID 뒷 6자리 사용 → 재실행해도 값 동일.
COGNITO_PREFIX="myticket-auth-${ACCOUNT_ID: -6}"

if [[ ! -f "$TFVARS" ]]; then
  cp "$TFVARS_EX" "$TFVARS"
  echo "terraform.tfvars 새로 생성 (from example)"
fi

# sed -i 에 백업 확장자 없이 쓰면 macOS BSD sed 에서 에러. 임시파일 경유가 안전.
sed_in_place() {
  local pat="$1" file="$2" tmp
  tmp="$(mktemp)"
  sed "$pat" "$file" > "$tmp" && mv "$tmp" "$file"
}
sed_in_place "s|^cognito_domain_prefix.*|cognito_domain_prefix = \"$COGNITO_PREFIX\"|" "$TFVARS"
sed_in_place "s|^github_repo.*|github_repo = \"$OWNER_REPO\"|" "$TFVARS"
echo "  cognito_domain_prefix = $COGNITO_PREFIX"
echo "  github_repo           = $OWNER_REPO"

# ── 5. ArgoCD repo URL ──
# repoURL/targetRevision 은 terraform.tfvars 의 github_repo · argocd_target_revision 으로만 결정된다.
# terraform apply 가 argocd/application.yaml 을 덮어쓰므로 여기서 application.yaml 을 sed 하면
# 다음 apply 와 충돌한다. fork 사용자는 위 4번에서 github_repo 가 이미 origin 과 맞춰진다.
echo "  ArgoCD: terraform apply 후 argocd/application.yaml 생성 (github_repo + argocd_target_revision)"

# ── 6. DB 비밀번호 → .env.local ──
ENV_FILE=".env.local"
echo ""
echo "─── RDS 마스터 비밀번호 ────────────────────"
if [[ -f "$ENV_FILE" ]] && grep -q '^DB_PASSWORD=' "$ENV_FILE"; then
  echo "$ENV_FILE 이미 존재 — 그대로 사용 (새로 받으려면 파일 삭제 후 재실행)"
else
  DB_PW=""
  if [[ -n "${DB_PASSWORD:-}" ]]; then
    DB_PW="$DB_PASSWORD"
    echo "  DB_PASSWORD 환경변수 사용 → $ENV_FILE 에 기록"
  elif [[ -n "${TF_VAR_db_password:-}" ]]; then
    DB_PW="$TF_VAR_db_password"
    echo "  TF_VAR_db_password 환경변수 사용 → $ENV_FILE 에 기록"
  fi

  if [[ -n "$DB_PW" ]]; then
    if [[ ${#DB_PW} -lt 8 ]]; then
      echo "ERROR: DB 비밀번호는 8자 이상이어야 합니다 (RDS 규칙)." >&2
      exit 1
    fi
  else
    echo "규칙: 8자 이상, 대/소문자+숫자+특수문자 조합 권장"
    echo "  (또는 미리: export TF_VAR_db_password='...' 또는 export DB_PASSWORD='...')"
    while :; do
      read -rsp "비밀번호 입력: " DB_PW; echo
      [[ ${#DB_PW} -ge 8 ]] || { echo "  8자 이상 필요"; continue; }
      read -rsp "확인 재입력:   " DB_PW2; echo
      [[ "$DB_PW" == "$DB_PW2" ]] || { echo "  불일치 — 재시도"; continue; }
      break
    done
    unset DB_PW2
  fi

  umask 077
  {
    echo "# prepare.sh 생성. setup-all.sh 가 자동 source 합니다. git 커밋 금지."
    printf 'export DB_PASSWORD=%q\n' "$DB_PW"
    printf 'export TF_VAR_db_password=%q\n' "$DB_PW"
  } > "$ENV_FILE"
  echo "$ENV_FILE 생성 완료 (gitignored)"
  unset DB_PW
fi

# ── 7. GitHub Secrets 자동 등록 ──
echo ""
echo "─── GitHub Secrets 등록 ──────────────────"
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  if gh secret set AWS_ACCOUNT_ID --body "$ACCOUNT_ID" --repo "$OWNER_REPO" >/dev/null 2>&1; then
    echo "  AWS_ACCOUNT_ID 등록 완료 ($ACCOUNT_ID)"
  else
    echo "  WARN: gh secret set 실패 — 권한 확인 또는 수동 등록:"
    echo "        Settings → Secrets and variables → Actions → AWS_ACCOUNT_ID=$ACCOUNT_ID"
  fi
  echo "  (CI/CD 를 쓰려면 AWS_ROLE_ARN 도 별도로 등록 필요 — modules/cicd 사용 시)"
else
  echo "  gh CLI 없음/미로그인 → 수동 등록:"
  echo "    GitHub repo → Settings → Secrets and variables → Actions"
  echo "      AWS_ACCOUNT_ID = $ACCOUNT_ID"
  echo "    (gh 설치 권장: https://cli.github.com/  →  gh auth login)"
fi

echo ""
hr; echo " prepare.sh 완료"; hr
echo " 다음 명령:"
echo "     bash scripts/setup-all.sh"
echo ""
