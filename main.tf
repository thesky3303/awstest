resource "random_string" "bucket_suffix" {
  length  = 8
  lower   = true
  upper   = false
  numeric = true
  special = false
}

locals {
  bucket_name = "${var.bucket_prefix}-${random_string.bucket_suffix.result}"

  source_dir_abs = abspath("${path.module}/${var.source_dir}")

  mime_types = {
    html  = "text/html; charset=utf-8"
    css   = "text/css; charset=utf-8"
    js    = "application/javascript; charset=utf-8"
    json  = "application/json; charset=utf-8"
    png   = "image/png"
    jpg   = "image/jpeg"
    jpeg  = "image/jpeg"
    gif   = "image/gif"
    svg   = "image/svg+xml"
    ico   = "image/x-icon"
    txt   = "text/plain; charset=utf-8"
    woff  = "font/woff"
    woff2 = "font/woff2"
    ttf   = "font/ttf"
    otf   = "font/otf"
    map   = "application/json; charset=utf-8"
  }

  static_files = fileset(local.source_dir_abs, "**/*")
}

resource "aws_s3_bucket" "site" {
  bucket        = local.bucket_name
  force_destroy = var.force_destroy

  tags = merge(
    {
      Name = local.bucket_name
    },
    var.tags
  )
}

resource "aws_s3_bucket_ownership_controls" "site" {
  bucket = aws_s3_bucket.site.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "site" {
  bucket = aws_s3_bucket.site.id

  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_website_configuration" "site" {
  bucket = aws_s3_bucket.site.id

  index_document {
    suffix = var.index_document
  }

  error_document {
    key = var.error_document
  }
}

data "aws_iam_policy_document" "bucket_read_policy" {
  dynamic "statement" {
    for_each = var.allow_public_read ? [1] : []
    content {
      sid     = "PublicReadGetObject"
      effect  = "Allow"
      actions = ["s3:GetObject"]

      principals {
        type        = "*"
        identifiers = ["*"]
      }

      resources = ["${aws_s3_bucket.site.arn}/*"]
    }
  }

  dynamic "statement" {
    for_each = var.cloudfront_distribution_arn != null ? [1] : []
    content {
      sid     = "CloudFrontReadGetObject"
      effect  = "Allow"
      actions = ["s3:GetObject"]

      principals {
        type        = "Service"
        identifiers = ["cloudfront.amazonaws.com"]
      }

      resources = ["${aws_s3_bucket.site.arn}/*"]

      condition {
        test     = "StringEquals"
        variable = "AWS:SourceArn"
        values   = [var.cloudfront_distribution_arn]
      }
    }
  }
}

resource "aws_s3_bucket_policy" "read_policy" {
  bucket = aws_s3_bucket.site.id
  policy = data.aws_iam_policy_document.bucket_read_policy.json

  depends_on = [
    aws_s3_bucket_public_access_block.site
  ]
}

resource "aws_s3_object" "static" {
  for_each = { for f in local.static_files : f => f }

  bucket = aws_s3_bucket.site.id
  key    = each.value
  source = "${local.source_dir_abs}/${each.value}"
  etag   = filemd5("${local.source_dir_abs}/${each.value}")

  content_type = lookup(
    local.mime_types,
    lower(element(concat(reverse(split(".", each.value)), [""]), 0)),
    "application/octet-stream"
  )

  cache_control = var.cache_control

  depends_on = [
    aws_s3_bucket_ownership_controls.site
  ]
}

