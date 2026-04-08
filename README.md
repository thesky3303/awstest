# S3_hosting (정적 웹 호스팅)

`ticketing-web/` 정적 파일을 S3 버킷에 업로드하고, **S3 Static Website Hosting**으로 접근할 수 있게 만드는 Terraform 구성입니다.

## 목표

- **저렴한 구성**: CloudFront 없이 S3 Website Hosting만 사용
- **버킷명 유니크**: `bucket_prefix` + 난수 suffix 조합으로 글로벌 유니크 보장
- **1-Hee에서 재사용 가능**: 필요한 값을 `output`으로 노출

## 사용 방법

```bash
cd C:\vm-share\S3_hosting

# AWS 자격증명은 본인 환경에 맞게 설정 (예: AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)
terraform init
terraform apply

# 결과 확인
terraform output
terraform output -raw website_url
```

## 입력 변수 (variables)

- `aws_region` (default: `ap-northeast-2`)
- `bucket_prefix` (default: `ticketing-web`)
- `source_dir` (default: `ticketing-web`)  
  - `S3_hosting` 폴더 기준 상대경로로 해석됩니다.
- `index_document` (default: `index.html`)
- `error_document` (default: `index.html`)
- `cache_control` (default: `no-cache`)
- `tags` (default: `{}`)
- `force_destroy` (default: `false`)

## 출력 (outputs) — 1-Hee에서 쓰기 좋은 값들

- `bucket_name` / `frontend_bucket_name`
- `website_url` / `frontend_website_url`
- `website_endpoint`, `website_domain`
- `regional_domain_name`
- `aws_region`
- `s3_static_site` (map 형태)

### 참고용(거의 완성본)과의 호환 키

`참고용/terraform.tfstate...`에서 보이는 키 중 일부를 **호환 목적**으로 같이 제공합니다.

- `cloudfront_domain` : 이 스택은 CloudFront를 만들지 않으므로 `null`
- `tickets_bucket_name` : 이 스택은 티켓용 버킷을 만들지 않으므로 `null`

