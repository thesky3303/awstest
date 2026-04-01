output "public_vpc_id" {
  value = aws_vpc.public_vpc.id
}

output "private_vpc_id" {
  value = aws_vpc.private_vpc.id
}

output "web_public_subnet_ids" {
  value = [
    aws_subnet.web_sn1.id,
    aws_subnet.web_sn2.id
  ]
}

output "was_private_subnet_ids" {
  value = [
    aws_subnet.was_sn1.id,
    aws_subnet.was_sn2.id
  ]
}

output "db_subnet_ids" {
  value = [
    aws_subnet.db_sn1.id,
    aws_subnet.db_sn2.id
  ]
}

output "eks_subnet_ids" {
  value = concat(
    [aws_subnet.web_sn1.id, aws_subnet.web_sn2.id],
    [aws_subnet.was_sn1.id, aws_subnet.was_sn2.id]
  )
}

output "web_route_table_id" {
  value = aws_route_table.web_public_rt.id
}

output "was_route_table_id" {
  value = aws_route_table.was_private_rt.id
}

output "db_route_table_id" {
  value = aws_route_table.db_private_rt.id
}

output "nat_gateway_id" {
  value = aws_nat_gateway.nat_gw.id
}

output "nat_eip_id" {
  value = aws_eip.nat_eip.id
}

output "nat_eip_public_ip" {
  value = aws_eip.nat_eip.public_ip
}

output "cluster_security_group_id" {
  value = aws_security_group.cluster_sg.id
}

output "alb_security_group_id" {
  value = aws_security_group.alb_sg.id
}

output "web_node_group_sg_id" {
  value = aws_security_group.web_node_group_sg.id
}

output "was_node_group_sg_id" {
  value = aws_security_group.was_node_group_sg.id
}

output "db_primary_sg_id" {
  value = aws_security_group.db_primary_sg.id
}

output "db_replica_sg_id" {
  value = aws_security_group.db_replica_sg.id
}

output "db_connection_peering_id" {
  value = aws_vpc_peering_connection.db_connection_peering.id
}

output "route53_zone_id" {
  value = data.aws_route53_zone.selected.zone_id
}

output "was_default_route_via_nat" {
  value = {
    route_table_id = aws_route.was_to_internet_via_nat.route_table_id
    destination    = aws_route.was_to_internet_via_nat.destination_cidr_block
    nat_gateway_id = aws_route.was_to_internet_via_nat.nat_gateway_id
  }
}

output "was_to_db_route" {
  value = {
    route_table_id = aws_route.was_to_db.route_table_id
    destination    = aws_route.was_to_db.destination_cidr_block
    peering_id     = aws_route.was_to_db.vpc_peering_connection_id
  }
}

output "db_to_public_route" {
  value = {
    route_table_id = aws_route.db_to_public.route_table_id
    destination    = aws_route.db_to_public.destination_cidr_block
    peering_id     = aws_route.db_to_public.vpc_peering_connection_id
  }
}

output "db_primary_from_was_rule" {
  value = {
    security_group_id = aws_security_group_rule.db_primary_from_was_3306.security_group_id
    source_sg_id      = aws_security_group_rule.db_primary_from_was_3306.source_security_group_id
    from_port         = aws_security_group_rule.db_primary_from_was_3306.from_port
    to_port           = aws_security_group_rule.db_primary_from_was_3306.to_port
    protocol          = aws_security_group_rule.db_primary_from_was_3306.protocol
  }
}

output "db_replica_from_web_rule" {
  value = {
    security_group_id = aws_security_group_rule.db_replica_from_web_3306.security_group_id
    source_sg_id      = aws_security_group_rule.db_replica_from_web_3306.source_security_group_id
    from_port         = aws_security_group_rule.db_replica_from_web_3306.from_port
    to_port           = aws_security_group_rule.db_replica_from_web_3306.to_port
    protocol          = aws_security_group_rule.db_replica_from_web_3306.protocol
  }
}