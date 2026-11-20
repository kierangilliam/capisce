package web

import (
	"net/http"
	"strings"

	"example.com/helpdesk/internal/accounts"
)

const sessionCookie = "helpdesk_session"

type actorHandler func(w http.ResponseWriter, r *http.Request, actor accounts.Actor)

// signedIn lets a request through only with a live session, and hands the
// handler the person behind it.
func (s *Server) signedIn(next actorHandler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor, err := s.Directory.Authenticate(sessionToken(r), s.Now())
		if err != nil {
			writeError(w, err)
			return
		}
		next(w, r, actor)
	}
}

// sessionToken reads the session from the cookie, or from a bearer token
// for clients that are not browsers.
func sessionToken(r *http.Request) string {
	if cookie, err := r.Cookie(sessionCookie); err == nil {
		return cookie.Value
	}
	token, _ := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
	return token
}
