variable "account_id" {
  type = string
}

variable "hello_forward_to" {
  description = "Inbox that receives mail for hello@betabook.ca. Set in Spacelift to keep it out of the public repo."
  type        = string
  sensitive   = true
}
