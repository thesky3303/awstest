output "bucket_name" {
  description = "Created S3 bucket name (randomized for global uniqueness)."
  value       = aws_s3_bucket.site.bucket
}

output "aws_region" {
  description = "AWS region used by this stack."
  value       = var.aws_region
}

output "bucket_arn" {
  description = "Created S3 bucket ARN."
  value       = aws_s3_bucket.site.arn
}

output "website_endpoint" {
  description = "S3 static website endpoint (HTTP)."
  value       = aws_s3_bucket_website_configuration.site.website_endpoint
}

output "website_url" {
  description = "Convenience URL for the S3 static website (HTTP)."
  value       = "http://${aws_s3_bucket_website_configuration.site.website_endpoint}"
}

output "frontend_bucket_name" {
  description = "Alias output for consumers that expect a frontend bucket name."
  value       = aws_s3_bucket.site.bucket
}

output "frontend_website_url" {
  description = "Alias output for consumers that expect a frontend website URL."
  value       = "http://${aws_s3_bucket_website_configuration.site.website_endpoint}"
}

output "website_domain" {
  description = "S3 static website domain."
  value       = aws_s3_bucket_website_configuration.site.website_domain
}

output "regional_domain_name" {
  description = "S3 regional bucket domain name (useful for CloudFront/origins)."
  value       = aws_s3_bucket.site.bucket_regional_domain_name
}

output "cloudfront_origin_domain_name" {
  description = "Origin domain name to use when attaching CloudFront (+WAF) later."
  value       = aws_s3_bucket.site.bucket_regional_domain_name
}

output "s3_static_site" {
  description = "Convenience object for other stacks (e.g. 1-Hee) via terraform_remote_state."
  value = {
    bucket_name          = aws_s3_bucket.site.bucket
    bucket_arn           = aws_s3_bucket.site.arn
    website_endpoint     = aws_s3_bucket_website_configuration.site.website_endpoint
    website_url          = "http://${aws_s3_bucket_website_configuration.site.website_endpoint}"
    website_domain       = aws_s3_bucket_website_configuration.site.website_domain
    regional_domain_name = aws_s3_bucket.site.bucket_regional_domain_name
    aws_region           = var.aws_region
  }
}

# Compatibility outputs (matching names seen in the 참고용 tfstate)
# - This stack is intentionally "cheap" (S3 website hosting only), so most of
#   the 참고용 outputs are not applicable here. We still expose the keys so that
#   consumers can keep a stable interface across stacks/environments.
output "alb_controller_role_arn" {
  description = "Compatibility key (not created in this stack)."
  value       = null
}

output "aws_account_id" {
  description = "Compatibility key (not created in this stack)."
  value       = null
}

output "cloudfront_domain" {
  description = "CloudFront domain (not created in this cheap S3-only stack)."
  value       = null
}

output "cognito_client_id" {
  description = "Compatibility key (not created in this stack)."
  value       = null
}

output "cognito_domain" {
  description = "Compatibility key (not created in this stack)."
  value       = null
}

output "cognito_user_pool_arn" {
  description = "Compatibility key (not created in this stack)."
  value       = null
}

output "cognito_user_pool_id" {
  description = "Compatibility key (not created in this stack)."
  value       = null
}

output "eks_cluster_name" {
  description = "Compatibility key (not created in this stack)."
  value       = null
}

output "github_actions_role_arn" {
  description = "Compatibility key (not created in this stack)."
  value       = null
}

output "monitoring_ec2_ip" {
  description = "Compatibility key (not created in this stack)."
  value       = null
}

output "rds_reader_endpoint" {
  description = "Compatibility key (not created in this stack)."
  value       = null
  sensitive   = true
}

output "rds_writer_endpoint" {
  description = "Compatibility key (not created in this stack)."
  value       = null
  sensitive   = true
}

output "redis_endpoint" {
  description = "Compatibility key (not created in this stack)."
  value       = null
  sensitive   = true
}

output "sns_confirmed_topic_arn" {
  description = "Compatibility key (not created in this stack)."
  value       = null
}

output "sqs_queue_url" {
  description = "Compatibility key (not created in this stack)."
  value       = null
}

output "tickets_bucket_name" {
  description = "Tickets bucket name (not created in this stack; present for compatibility with 참고용 outputs)."
  value       = null
}

output "vpc_id" {
  description = "Compatibility key (not created in this stack)."
  value       = null
}


