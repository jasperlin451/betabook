locals {
  # lib/email.ts sends contact form messages here.
  hello_address = "hello@betabook.ca"
}

# Owns the routing MX, SPF and cf2024-1 DKIM records.
resource "cloudflare_email_routing_dns" "betabook" {
  zone_id = cloudflare_zone.betabook.id
  name    = local.zone_name
}

resource "cloudflare_email_routing_rule" "hello" {
  zone_id = cloudflare_zone.betabook.id

  matchers = [{
    type  = "literal"
    field = "to"
    value = local.hello_address
  }]

  actions = [{
    type  = "forward"
    value = [var.hello_forward_to]
  }]
}
