package web

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"

	"example.com/helpdesk/internal/accounts"
	"example.com/helpdesk/internal/deadlines"
	"example.com/helpdesk/internal/tickets"
)

var errBadBody = errors.New("the request body must be JSON")

var statusOf = map[error]int{
	errBadBody:                    http.StatusBadRequest,
	tickets.ErrMissingText:        http.StatusBadRequest,
	deadlines.ErrUnknownPriority:  http.StatusBadRequest,
	accounts.ErrUnknownPlan:       http.StatusBadRequest,
	accounts.ErrBadCredentials:    http.StatusUnauthorized,
	accounts.ErrNotSignedIn:       http.StatusUnauthorized,
	accounts.ErrAgentInactive:     http.StatusForbidden,
	accounts.ErrNotAllowed:        http.StatusForbidden,
	tickets.ErrPriorityNotAllowed: http.StatusForbidden,
	tickets.ErrTicketNotFound:     http.StatusNotFound,
	accounts.ErrCustomerNotFound:  http.StatusNotFound,
	accounts.ErrAgentNotFound:     http.StatusNotFound,
	tickets.ErrStatusChange:       http.StatusConflict,
	tickets.ErrTicketClosed:       http.StatusConflict,
	tickets.ErrReopenWindowPassed: http.StatusConflict,
	tickets.ErrAlreadyEscalated:   http.StatusConflict,
	accounts.ErrLastLead:          http.StatusConflict,
	tickets.ErrAssigneeNotInTeam:  http.StatusUnprocessableEntity,
}

// readJSON reads the request body. An empty body is fine: every field
// keeps its zero value.
func readJSON(r *http.Request, into any) error {
	err := json.NewDecoder(http.MaxBytesReader(nil, r.Body, 1<<20)).Decode(into)
	if err != nil && !errors.Is(err, io.EOF) {
		return errBadBody
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		log.Printf("write response: %v", err)
	}
}

// writeError answers with the status of a named error and its message.
// Any other error is logged and answered with a plain 500.
func writeError(w http.ResponseWriter, err error) {
	for named, status := range statusOf {
		if errors.Is(err, named) {
			writeJSON(w, status, map[string]string{"error": named.Error()})
			return
		}
	}
	log.Printf("unexpected error: %v", err)
	writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Something went wrong. Try again."})
}
