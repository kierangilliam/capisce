package web

import (
	"net/http"

	"example.com/helpdesk/internal/accounts"
	"example.com/helpdesk/internal/notify"
)

func (s *Server) overdueReport(w http.ResponseWriter, r *http.Request, actor accounts.Actor) {
	late, err := s.Tickets.Overdue(actor, s.Now())
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, late)
}

func (s *Server) listNotices(w http.ResponseWriter, r *http.Request, actor accounts.Actor) {
	writeJSON(w, http.StatusOK, s.Outbox.For(recipient(actor)))
}

func (s *Server) markNoticesRead(w http.ResponseWriter, r *http.Request, actor accounts.Actor) {
	marked := s.Outbox.MarkAllRead(recipient(actor))
	writeJSON(w, http.StatusOK, map[string]int{"marked_read": marked})
}

func recipient(actor accounts.Actor) notify.Recipient {
	if actor.IsAgent() {
		return notify.ToAgent(actor.AgentID)
	}
	return notify.ToCustomer(actor.CustomerID)
}
