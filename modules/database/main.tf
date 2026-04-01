# RDS 생성 전용
# 테이블 및 초기 SQL은 RDS 생성 후 별도 진행
# schema.sql 또는 DB 클라이언트로 초기화

resource "aws_db_subnet_group" "db_subnet_group" {
  name       = "${var.project_name}-db-subnet-group-v2"
  subnet_ids = var.db_subnet_ids

  tags = {
    Name = "${var.project_name}-db-subnet-group-v2"
  }
}

resource "aws_db_instance" "primary" {
  identifier               = "${var.project_name}-primary"
  allocated_storage        = var.allocated_storage
  engine                   = var.db_engine
  engine_version           = var.db_engine_version
  instance_class           = var.db_instance_class
  db_name                  = var.db_name
  username                 = var.db_username
  password                 = var.db_password
  db_subnet_group_name     = aws_db_subnet_group.db_subnet_group.name
  vpc_security_group_ids   = [var.db_primary_sg_id]
  publicly_accessible      = false
  skip_final_snapshot      = true
  backup_retention_period  = 1

  tags = {
    Name = "${var.project_name}-rds-primary"
  }
}

resource "aws_db_instance" "replica" {
  identifier          = "${var.project_name}-replica"
  replicate_source_db = aws_db_instance.primary.identifier
  instance_class      = var.db_instance_class
  publicly_accessible = false
  skip_final_snapshot = true

  tags = {
    Name = "${var.project_name}-rds-replica"
  }
}
