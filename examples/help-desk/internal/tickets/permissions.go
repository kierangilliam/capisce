package tickets

import (
	"time"

	"example.com/helpdesk/internal/accounts"
)

// ReopenWindow is how long after closing a ticket can still be reopened
// by a customer or an agent. A lead may reopen at any time.
const ReopenWindow = 7 * 24 * time.Hour

// CanView: a customer sees their own tickets, an agent their team's.
func CanView(actor accounts.Actor, ticket *Ticket) bool {
	if actor.IsCustomer() {
		return ticket.CustomerID == actor.CustomerID
	}
	return CanWorkOn(actor, ticket)
}

// CanWorkOn: only agents on the ticket's team work on it.
func CanWorkOn(actor accounts.Actor, ticket *Ticket) bool {
	return actor.IsAgent() && actor.TeamID == ticket.TeamID
}

// CanAssign: a lead may give the ticket to anyone. Other agents may only
// take a ticket nobody has.
func CanAssign(actor accounts.Actor, ticket *Ticket, toAgentID string) bool {
	if !CanWorkOn(actor, ticket) {
		return false
	}
	if actor.Lead {
		return true
	}
	return ticket.AssignedAgentID == "" && toAgentID == actor.AgentID
}

// CanEscalate: only a lead of the ticket's team.
func CanEscalate(actor accounts.Actor, ticket *Ticket) bool {
	return actor.Lead && CanWorkOn(actor, ticket)
}

// CanReopen: anyone who sees the ticket, within the reopen window. A lead
// of the team is not held to the window.
func CanReopen(actor accounts.Actor, ticket *Ticket, now time.Time) bool {
	if !CanView(actor, ticket) {
		return false
	}
	if actor.Lead {
		return true
	}
	return now.Sub(ticket.ClosedAt) <= ReopenWindow
}

// visibleTo is the copy of a ticket one person gets. Customers do not get
// internal notes.
func visibleTo(actor accounts.Actor, ticket *Ticket) Ticket {
	view := *ticket
	view.Replies = []Reply{}
	for _, reply := range ticket.Replies {
		if reply.Internal && !actor.IsAgent() {
			continue
		}
		view.Replies = append(view.Replies, reply)
	}
	return view
}
