package de.motis.prima.viewmodel

import androidx.lifecycle.ViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import de.motis.prima.data.DataRepository
import de.motis.prima.data.EventObject
import de.motis.prima.data.Ticket
import de.motis.prima.data.ValidationStatus
import javax.inject.Inject

@HiltViewModel
class EventGroupViewModel @Inject constructor(
    private val repository: DataRepository
) : ViewModel() {
    val storedTickets = repository.storedTickets
    val ptLegs = repository.ptLegs
    val updateError = repository.updateError

    fun getValidCount(eventGroupId: String): Int {
        var tickets = repository.getTicketsForEventGroup(eventGroupId)
        tickets = tickets.filter { t ->
            t.validationStatus == ValidationStatus.DONE.name ||
                    t.validationStatus == ValidationStatus.CHECKED_IN.name
        }
        return tickets.size
    }

    fun updateTicket(requestId: Int, ticketHash: String) {
        repository.updateTicketStore(Ticket(requestId, ticketHash, "", ValidationStatus.DONE))
    }

    fun setItineraries(ids: Set<Int>) {
        repository.setUpdateIds(ids)
    }

    fun getItinerary(requestId: Int) {
        repository.getItinerary(requestId)
    }

    fun getEvent(id: Int): EventObject? {
        return repository.getEvent(id)
    }
}