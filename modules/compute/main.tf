data "aws_iam_policy_document" "eks_cluster_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["eks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "eks_cluster_role" {
  name               = "${var.project_name}-eks-cluster-role"
  assume_role_policy = data.aws_iam_policy_document.eks_cluster_assume.json
}

resource "aws_iam_role_policy_attachment" "eks_cluster_policy" {
  role       = aws_iam_role.eks_cluster_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
}

resource "aws_iam_role_policy_attachment" "was_node_ssm_policy" {
  role       = aws_iam_role.was_node_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy_attachment" "web_node_ssm_policy" {
  role       = aws_iam_role.web_node_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

data "aws_iam_policy_document" "eks_node_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "web_node_role" {
  name               = "${var.project_name}-web-node-role"
  assume_role_policy = data.aws_iam_policy_document.eks_node_assume.json
}

resource "aws_iam_role" "was_node_role" {
  name               = "${var.project_name}-was-node-role"
  assume_role_policy = data.aws_iam_policy_document.eks_node_assume.json
}

resource "aws_iam_role_policy_attachment" "web_node_worker_policy" {
  role       = aws_iam_role.web_node_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
}

resource "aws_iam_role_policy_attachment" "web_node_cni_policy" {
  role       = aws_iam_role.web_node_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
}

resource "aws_iam_role_policy_attachment" "web_node_ecr_policy" {
  role       = aws_iam_role.web_node_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

resource "aws_iam_role_policy_attachment" "was_node_worker_policy" {
  role       = aws_iam_role.was_node_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
}

resource "aws_iam_role_policy_attachment" "was_node_cni_policy" {
  role       = aws_iam_role.was_node_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
}

resource "aws_iam_role_policy_attachment" "was_node_ecr_policy" {
  role       = aws_iam_role.was_node_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

resource "aws_eks_cluster" "main" {
  name     = var.eks_cluster_name
  role_arn = aws_iam_role.eks_cluster_role.arn
  version  = var.eks_cluster_version

  vpc_config {
    subnet_ids              = var.eks_subnet_ids
    endpoint_public_access  = true
    endpoint_private_access = true
    security_group_ids      = [var.cluster_security_group_id]
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_cluster_policy
  ]
}

resource "aws_launch_template" "web_node_lt" {
  name_prefix   = "${var.project_name}-web-node-lt-"
  instance_type = var.web_node_group_instance_type
  key_name      = var.key_name

  vpc_security_group_ids = [
    var.web_node_group_sg_id
  ]

  tag_specifications {
    resource_type = "instance"

    tags = {
      Name = "${var.project_name}-web-node"
      Role = "web"
    }
  }

  tag_specifications {
    resource_type = "volume"

    tags = {
      Name = "${var.project_name}-web-node-volume"
      Role = "web"
    }
  }

  tags = {
    Name = "${var.project_name}-web-node-lt"
    Role = "web"
  }
}

resource "aws_launch_template" "was_node_lt" {
  name_prefix   = "${var.project_name}-was-node-lt-"
  instance_type = var.was_node_group_instance_type
  

  vpc_security_group_ids = [
    var.was_node_group_sg_id
  ]

  tag_specifications {
    resource_type = "instance"

    tags = {
      Name = "${var.project_name}-was-node"
      Role = "was"
    }
  }

  tag_specifications {
    resource_type = "volume"

    tags = {
      Name = "${var.project_name}-was-node-volume"
      Role = "was"
    }
  }

  tags = {
    Name = "${var.project_name}-was-node-lt"
    Role = "was"
  }
}

resource "aws_eks_node_group" "web_node_group" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = var.web_node_group_name
  node_role_arn   = aws_iam_role.web_node_role.arn
  subnet_ids      = var.web_public_subnet_ids

  ami_type      = "AL2023_x86_64_STANDARD"
  capacity_type = "ON_DEMAND"

  launch_template {
    id      = aws_launch_template.web_node_lt.id
    version = "$Latest"
  }

  scaling_config {
    desired_size = var.web_node_group_desired_count
    min_size     = var.web_node_group_min_count
    max_size     = var.web_node_group_max_count
  }

  labels = {
    role = "web"
  }

  depends_on = [
    aws_iam_role_policy_attachment.web_node_worker_policy,
    aws_iam_role_policy_attachment.web_node_cni_policy,
    aws_iam_role_policy_attachment.web_node_ecr_policy
  ]
}

resource "aws_eks_node_group" "was_node_group" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = var.was_node_group_name
  node_role_arn   = aws_iam_role.was_node_role.arn
  subnet_ids      = var.was_private_subnet_ids

  ami_type      = "AL2023_x86_64_STANDARD"
  capacity_type = "ON_DEMAND"

  launch_template {
    id      = aws_launch_template.was_node_lt.id
    version = "$Latest"
  }

  scaling_config {
    desired_size = var.was_node_group_desired_count
    min_size     = var.was_node_group_min_count
    max_size     = var.was_node_group_max_count
  }

  labels = {
    role = "was"
  }

  depends_on = [
    aws_iam_role_policy_attachment.was_node_worker_policy,
    aws_iam_role_policy_attachment.was_node_cni_policy,
    aws_iam_role_policy_attachment.was_node_ecr_policy
  ]
}

resource "aws_lb" "main_alb" {
  name               = "${var.project_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [var.alb_security_group_id]
  subnets            = var.web_public_subnet_ids

  tags = {
    Name = "${var.project_name}-alb"
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main_alb.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "fixed-response"

    fixed_response {
      content_type = "text/plain"
      message_body = "ALB ready"
      status_code  = "200"
    }
  }
}