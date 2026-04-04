output "cloudfront_domain_name" {
  value = aws_cloudfront_distribution.this.domain_name
}

output "route53_record_fqdn" {
  value = aws_route53_record.root_alias.fqdn
}
