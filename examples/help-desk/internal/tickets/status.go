package tickets

import (
	"errors"
	"time"
)

var ErrStatusChange = errors.New("the ticket cannot go to that status from where it is")

var allowedMoves = map[Status][]Status{
	StatusNew:     {StatusOpen, StatusWaiting, StatusClosed},
	StatusOpen:    {StatusWaiting, StatusClosed},
	StatusWaiting: {StatusOpen, StatusClosed},
	StatusClosed:  {StatusOpen},
}

func canMove(from, to Status) bool {
	for _, allowed := range allowedMoves[from] {
		if allowed == to {
			return true
		}
	}
	return false
}

// move changes a ticket's status and keeps its deadline in step. The
// customer's wait ends when we reply or the ticket closes, and starts
// again when a waiting or closed ticket comes back to us.
func (s *Service) move(ticket *Ticket, to Status, now time.Time) error {
	from := ticket.Status
	if !canMove(from, to) {
		return ErrStatusChange
	}
	ticket.Status = to
	switch to {
	case StatusWaiting:
		stopClock(ticket)
	case StatusClosed:
		stopClock(ticket)
		ticket.ClosedAt = now
	case StatusOpen:
		if from != StatusNew {
			ticket.ClosedAt = time.Time{}
			s.startClock(ticket, now)
		}
	}
	return nil
}
