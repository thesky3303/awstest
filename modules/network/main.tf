resource "aws_vpc" "public_vpc" {
  cidr_block           = var.public_vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "Public_VPC"
  }
}

resource "aws_vpc" "private_vpc" {
  cidr_block           = var.private_vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "Private_VPC"
  }
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.public_vpc.id

  tags = {
    Name = "IGW"
  }
}

resource "aws_subnet" "web_sn1" {
  vpc_id                  = aws_vpc.public_vpc.id
  cidr_block              = var.public_vpc_web_pub_rt_sn1_cidr
  availability_zone       = var.az_1
  map_public_ip_on_launch = true

  tags = {
    Name = "Public_VPC_Web_Pub_RT_SN1"
  }
}

resource "aws_subnet" "web_sn2" {
  vpc_id                  = aws_vpc.public_vpc.id
  cidr_block              = var.public_vpc_web_pub_rt_sn2_cidr
  availability_zone       = var.az_2
  map_public_ip_on_launch = true

  tags = {
    Name = "Public_VPC_Web_Pub_RT_SN2"
  }
}

resource "aws_subnet" "was_sn1" {
  vpc_id            = aws_vpc.public_vpc.id
  cidr_block        = var.public_vpc_was_pri_rt_sn1_cidr
  availability_zone = var.az_1

  tags = {
    Name = "Public_VPC_WAS_Pri_RT_SN1"
  }
}

resource "aws_subnet" "was_sn2" {
  vpc_id            = aws_vpc.public_vpc.id
  cidr_block        = var.public_vpc_was_pri_rt_sn2_cidr
  availability_zone = var.az_2

  tags = {
    Name = "Public_VPC_WAS_Pri_RT_SN2"
  }
}

resource "aws_subnet" "db_sn1" {
  vpc_id            = aws_vpc.private_vpc.id
  cidr_block        = var.private_vpc_db_pri_rt_sn1_cidr
  availability_zone = var.az_1

  tags = {
    Name = "Private_VPC_DB_Pri_RT_SN1"
  }
}

resource "aws_subnet" "db_sn2" {
  vpc_id            = aws_vpc.private_vpc.id
  cidr_block        = var.private_vpc_db_pri_rt_sn2_cidr
  availability_zone = var.az_2

  tags = {
    Name = "Private_VPC_DB_Pri_RT_SN2"
  }
}

resource "aws_eip" "nat_eip" {
  domain = "vpc"

  tags = {
    Name = "NAT_EIP"
  }

  depends_on = [aws_internet_gateway.igw]
}

resource "aws_nat_gateway" "nat_gw" {
  allocation_id = aws_eip.nat_eip.id
  subnet_id     = aws_subnet.web_sn1.id

  tags = {
    Name = "WAS_NAT_GW"
  }

  depends_on = [aws_internet_gateway.igw]
}

resource "aws_route_table" "web_public_rt" {
  vpc_id = aws_vpc.public_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }

  tags = {
    Name = "Public_VPC_Web_Pub_RT"
  }
}

resource "aws_route_table" "was_private_rt" {
  vpc_id = aws_vpc.public_vpc.id

  tags = {
    Name = "Public_VPC_WAS_Pri_RT"
  }
}

resource "aws_route_table" "db_private_rt" {
  vpc_id = aws_vpc.private_vpc.id

  tags = {
    Name = "Private_VPC_DB_Pri_RT"
  }
}

resource "aws_route" "was_to_internet_via_nat" {
  route_table_id         = aws_route_table.was_private_rt.id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.nat_gw.id
}

resource "aws_route_table_association" "web_sn1_assoc" {
  subnet_id      = aws_subnet.web_sn1.id
  route_table_id = aws_route_table.web_public_rt.id
}

resource "aws_route_table_association" "web_sn2_assoc" {
  subnet_id      = aws_subnet.web_sn2.id
  route_table_id = aws_route_table.web_public_rt.id
}

resource "aws_route_table_association" "was_sn1_assoc" {
  subnet_id      = aws_subnet.was_sn1.id
  route_table_id = aws_route_table.was_private_rt.id
}

resource "aws_route_table_association" "was_sn2_assoc" {
  subnet_id      = aws_subnet.was_sn2.id
  route_table_id = aws_route_table.was_private_rt.id
}

resource "aws_route_table_association" "db_sn1_assoc" {
  subnet_id      = aws_subnet.db_sn1.id
  route_table_id = aws_route_table.db_private_rt.id
}

resource "aws_route_table_association" "db_sn2_assoc" {
  subnet_id      = aws_subnet.db_sn2.id
  route_table_id = aws_route_table.db_private_rt.id
}

resource "aws_vpc_peering_connection" "db_connection_peering" {
  vpc_id      = aws_vpc.public_vpc.id
  peer_vpc_id = aws_vpc.private_vpc.id
  auto_accept = true

  tags = {
    Name = "DB_Connection_Peering"
  }
}

resource "aws_route" "was_to_db" {
  route_table_id            = aws_route_table.was_private_rt.id
  destination_cidr_block    = aws_vpc.private_vpc.cidr_block
  vpc_peering_connection_id = aws_vpc_peering_connection.db_connection_peering.id
}

resource "aws_route" "db_to_public" {
  route_table_id            = aws_route_table.db_private_rt.id
  destination_cidr_block    = aws_vpc.public_vpc.cidr_block
  vpc_peering_connection_id = aws_vpc_peering_connection.db_connection_peering.id
}

resource "aws_security_group" "cluster_sg" {
  name   = "${var.project_name}-cluster-sg"
  vpc_id = aws_vpc.public_vpc.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "Cluster_SG"
  }
}

resource "aws_security_group" "alb_sg" {
  name   = "${var.project_name}-alb-sg"
  vpc_id = aws_vpc.public_vpc.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = -1
    to_port     = -1
    protocol    = "icmp"
    cidr_blocks = [var.admin_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "ALB_SG"
  }
}

resource "aws_security_group" "web_node_group_sg" {
  name   = "${var.project_name}-web-node-group-sg"
  vpc_id = aws_vpc.public_vpc.id

  ingress {
    description = "Node to same web node group"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    self        = true
  }

  ingress {
    description = "ICMP from admin"
    from_port   = -1
    to_port     = -1
    protocol    = "icmp"
    cidr_blocks = [var.admin_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "Web_Node_Group_SG"
  }
}

resource "aws_security_group" "was_node_group_sg" {
  name   = "${var.project_name}-was-node-group-sg"
  vpc_id = aws_vpc.public_vpc.id

  ingress {
    description = "Node to same was node group"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    self        = true
  }

  ingress {
    description = "ICMP from admin"
    from_port   = -1
    to_port     = -1
    protocol    = "icmp"
    cidr_blocks = [var.admin_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "WAS_Node_Group_SG"
  }
}

resource "aws_security_group" "db_primary_sg" {
  name   = "${var.project_name}-db-primary-sg"
  vpc_id = aws_vpc.private_vpc.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "DB_Primary_SG"
  }
}

resource "aws_security_group" "db_replica_sg" {
  name   = "${var.project_name}-db-replica-sg"
  vpc_id = aws_vpc.private_vpc.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "DB_Replica_SG"
  }
}

resource "aws_security_group_rule" "cluster_from_web_443" {
  type                     = "ingress"
  from_port                = 443
  to_port                  = 443
  protocol                 = "tcp"
  security_group_id        = aws_security_group.cluster_sg.id
  source_security_group_id = aws_security_group.web_node_group_sg.id
}

resource "aws_security_group_rule" "cluster_from_was_443" {
  type                     = "ingress"
  from_port                = 443
  to_port                  = 443
  protocol                 = "tcp"
  security_group_id        = aws_security_group.cluster_sg.id
  source_security_group_id = aws_security_group.was_node_group_sg.id
}

resource "aws_security_group_rule" "web_from_alb_30080" {
  type                     = "ingress"
  from_port                = 30080
  to_port                  = 30080
  protocol                 = "tcp"
  security_group_id        = aws_security_group.web_node_group_sg.id
  source_security_group_id = aws_security_group.alb_sg.id
}

resource "aws_security_group_rule" "web_from_was_all" {
  type                     = "ingress"
  from_port                = 0
  to_port                  = 0
  protocol                 = "-1"
  security_group_id        = aws_security_group.web_node_group_sg.id
  source_security_group_id = aws_security_group.was_node_group_sg.id
}

resource "aws_security_group_rule" "web_from_cluster_10250" {
  type                     = "ingress"
  from_port                = 10250
  to_port                  = 10250
  protocol                 = "tcp"
  security_group_id        = aws_security_group.web_node_group_sg.id
  source_security_group_id = aws_security_group.cluster_sg.id
}

resource "aws_security_group_rule" "was_from_web_30081" {
  type                     = "ingress"
  from_port                = 30081
  to_port                  = 30081
  protocol                 = "tcp"
  security_group_id        = aws_security_group.was_node_group_sg.id
  source_security_group_id = aws_security_group.web_node_group_sg.id
}

resource "aws_security_group_rule" "was_from_web_all" {
  type                     = "ingress"
  from_port                = 0
  to_port                  = 0
  protocol                 = "-1"
  security_group_id        = aws_security_group.was_node_group_sg.id
  source_security_group_id = aws_security_group.web_node_group_sg.id
}

resource "aws_security_group_rule" "was_from_cluster_10250" {
  type                     = "ingress"
  from_port                = 10250
  to_port                  = 10250
  protocol                 = "tcp"
  security_group_id        = aws_security_group.was_node_group_sg.id
  source_security_group_id = aws_security_group.cluster_sg.id
}

resource "aws_security_group_rule" "db_primary_from_was_3306" {
  type                     = "ingress"
  from_port                = 3306
  to_port                  = 3306
  protocol                 = "tcp"
  security_group_id        = aws_security_group.db_primary_sg.id
  source_security_group_id = aws_security_group.was_node_group_sg.id
}

resource "aws_security_group_rule" "db_replica_from_web_3306" {
  type                     = "ingress"
  from_port                = 3306
  to_port                  = 3306
  protocol                 = "tcp"
  security_group_id        = aws_security_group.db_replica_sg.id
  source_security_group_id = aws_security_group.web_node_group_sg.id
}

resource "aws_security_group_rule" "web_ssh_from_all" {
  type              = "ingress"
  from_port         = 22
  to_port           = 22
  protocol          = "tcp"
  security_group_id = aws_security_group.web_node_group_sg.id
  cidr_blocks       = ["0.0.0.0/0"]
}

resource "aws_security_group_rule" "was_ssh_from_web" {
  type                     = "ingress"
  from_port                = 22
  to_port                  = 22
  protocol                 = "tcp"
  security_group_id        = aws_security_group.was_node_group_sg.id
  source_security_group_id = aws_security_group.web_node_group_sg.id
}


data "aws_region" "current" {}

data "aws_route53_zone" "selected" {
  name         = var.route53_zone_name
  private_zone = false
}