package web

import "net/http"

// Routes lists every endpoint. All but sign-in need a signed-in person.
func (s *Server) Routes() *http.ServeMux {
	mux := http.NewServeMux()

	mux.HandleFunc("POST /sign-in", s.signIn)
	mux.HandleFunc("POST /sign-out", s.signOut)

	mux.HandleFunc("GET /tickets", s.signedIn(s.listTickets))
	mux.HandleFunc("POST /tickets", s.signedIn(s.openTicket))
	mux.HandleFunc("GET /tickets/{id}", s.signedIn(s.showTicket))
	mux.HandleFunc("POST /tickets/{id}/replies", s.signedIn(s.replyToTicket))
	mux.HandleFunc("POST /tickets/{id}/assign", s.signedIn(s.assignTicket))
	mux.HandleFunc("PUT /tickets/{id}/priority", s.signedIn(s.changePriority))
	mux.HandleFunc("POST /tickets/{id}/escalate", s.signedIn(s.escalateTicket))
	mux.HandleFunc("POST /tickets/{id}/close", s.signedIn(s.closeTicket))
	mux.HandleFunc("POST /tickets/{id}/reopen", s.signedIn(s.reopenTicket))

	mux.HandleFunc("GET /customers", s.signedIn(s.listCustomers))
	mux.HandleFunc("PUT /customers/{id}/plan", s.signedIn(s.changePlan))
	mux.HandleFunc("GET /agents", s.signedIn(s.listAgents))
	mux.HandleFunc("POST /agents/{id}/deactivate", s.signedIn(s.deactivateAgent))

	mux.HandleFunc("GET /reports/overdue", s.signedIn(s.overdueReport))
	mux.HandleFunc("GET /notices", s.signedIn(s.listNotices))
	mux.HandleFunc("POST /notices/read", s.signedIn(s.markNoticesRead))

	return mux
}
