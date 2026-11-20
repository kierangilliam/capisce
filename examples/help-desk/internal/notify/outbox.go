// Package notify keeps the notices people get about their tickets.
package notify

import (
	"fmt"
	"sync"
	"time"
)

// Recipient is who a notice is for: a customer or an agent.
type Recipient struct {
	CustomerID string
	AgentID    string
}

func ToCustomer(id string) Recipient { return Recipient{CustomerID: id} }
func ToAgent(id string) Recipient    { return Recipient{AgentID: id} }

// Outbox keeps every notice in memory. People read theirs in the app.
type Outbox struct {
	mu      sync.Mutex
	notices []Notice
}

func NewOutbox() *Outbox { return &Outbox{} }

// Send leaves a notice for one person. It is skipped when they already
// have an unread notice of the same kind about the same ticket, so a busy
// ticket does not flood anyone. It reports whether a notice was left.
func (o *Outbox) Send(to Recipient, kind Kind, ticketID, text string, now time.Time) bool {
	if to == (Recipient{}) {
		return false
	}
	o.mu.Lock()
	defer o.mu.Unlock()
	for _, notice := range o.notices {
		if recipientOf(notice) == to && notice.Kind == kind && notice.TicketID == ticketID && !notice.Read {
			return false
		}
	}
	o.notices = append(o.notices, Notice{
		ID:           fmt.Sprintf("N-%d", len(o.notices)+1),
		ToCustomerID: to.CustomerID,
		ToAgentID:    to.AgentID,
		TicketID:     ticketID,
		Kind:         kind,
		Text:         text,
		SentAt:       now,
	})
	return true
}

// For lists one person's notices, newest first.
func (o *Outbox) For(to Recipient) []Notice {
	o.mu.Lock()
	defer o.mu.Unlock()
	mine := []Notice{}
	for index := len(o.notices) - 1; index >= 0; index-- {
		if recipientOf(o.notices[index]) == to {
			mine = append(mine, o.notices[index])
		}
	}
	return mine
}

// MarkAllRead marks every notice of one person as read and reports how
// many were unread.
func (o *Outbox) MarkAllRead(to Recipient) int {
	o.mu.Lock()
	defer o.mu.Unlock()
	marked := 0
	for index := range o.notices {
		if recipientOf(o.notices[index]) == to && !o.notices[index].Read {
			o.notices[index].Read = true
			marked++
		}
	}
	return marked
}

func recipientOf(notice Notice) Recipient {
	return Recipient{CustomerID: notice.ToCustomerID, AgentID: notice.ToAgentID}
}
