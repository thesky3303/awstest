variable "aws_region" {
  description = "AWS region where the S3 bucket will be created."
  type        = string
  default     = "ap-northeast-2"
}

variable "bucket_prefix" {
  description = "Bucket name prefix. A random suffix will be appended to make it globally unique."
  type        = string
  default     = "ticketing-web"
}

variable "source_dir" {
  description = "Local directory that contains the static web assets to upload."
  type        = string
  # Keep this a plain string (no expressions) so Terraform can init/validate.
  # It can be relative to this module directory.
  default = "ticketing-web"
}

variable "index_document" {
  description = "Website index document."
  type        = string
  default     = "index.html"
}

variable "error_document" {
  description = "Website error document."
  type        = string
  default     = "index.html"
}

variable "cache_control" {
  description = "Cache-Control header to apply to uploaded objects. Set null to omit."
  type        = string
  default     = "no-cache"
}

variable "tags" {
  description = "Tags applied to AWS resources."
  type        = map(string)
  default     = {}
}

variable "force_destroy" {
  description = "If true, allow Terraform to delete the bucket even if it contains objects."
  type        = bool
  default     = false
}

variable "allow_public_read" {
  description = "If true, allow public s3:GetObject for website hosting. Turn this off when switching to CloudFront + WAF (recommended)."
  type        = bool
  default     = true
}

variable "cloudfront_distribution_arn" {
  description = "If set, allow CloudFront (OAC) to read objects via bucket policy condition AWS:SourceArn."
  type        = string
  default     = null
}

