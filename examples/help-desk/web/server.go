// Package web is the HTTP layer of the help desk. It serves JSON.
package web

import (
	"time"

	"example.com/helpdesk/internal/accounts"
	"example.com/helpdesk/internal/notify"
	"example.com/helpdesk/internal/tickets"
)

// Server holds what the handlers need.
type Server struct {
	Directory *accounts.Directory
	Tickets   *tickets.Service
	Outbox    *notify.Outbox
	Now       func() time.Time
}

func NewServer(directory *accounts.Directory, service *tickets.Service, outbox *notify.Outbox) *Server {
	return &Server{Directory: directory, Tickets: service, Outbox: outbox, Now: time.Now}
}
