# ArgoCD Application 은 항상 이 파일 이름으로 쓴다 (install-argocd.sh / 문서 / prepare.sh 와 동일).
# var.github_repo + var.argocd_target_revision 은 variables.tf 기본값 또는 terraform.tfvars 로만 조정.
# 단일 진실: application.yaml.tpl → terraform apply → argocd/application.yaml
resource "local_file" "argocd_application" {
  filename = "${path.root}/../argocd/application.yaml"
  content = templatefile("${path.root}/../argocd/application.yaml.tpl", {
    repo_url        = "https://github.com/${var.github_repo}.git"
    target_revision = var.argocd_target_revision
  })

  file_permission      = "0644"
  directory_permission = "0755"
}
