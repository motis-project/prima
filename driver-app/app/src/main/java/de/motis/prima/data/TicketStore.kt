package de.motis.prima.data

import io.realm.kotlin.Realm
import io.realm.kotlin.ext.query
import io.realm.kotlin.query.RealmResults
import io.realm.kotlin.types.RealmObject
import io.realm.kotlin.types.annotations.PrimaryKey
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject

enum class ValidationStatus {
    CHECKED_IN, DONE, REJECTED, OPEN
}

data class Ticket(
    val requestId: Int,
    val ticketHash: String,
    val ticketCode: String,
    var validationStatus: ValidationStatus
)

class TicketObject : RealmObject {
    @PrimaryKey
    var requestId: Int = 0
    var ticketHash: String = ""
    var ticketCode: String = ""
    var validationStatus: String = ValidationStatus.OPEN.name
}

class TicketStore @Inject constructor(private val realm: Realm) {

    private val _storedTickets = MutableStateFlow(getAll())
    val storedTickets = _storedTickets.asStateFlow()

    fun update(ticket: Ticket) {
        try {
            val storedTicket = realm.query<TicketObject>("requestId == $0", ticket.requestId).find().first()
            if (ticket.validationStatus == ValidationStatus.CHECKED_IN || ticket.validationStatus == ValidationStatus.DONE ) {
                realm.writeBlocking {
                    storedTicket.let {
                        findLatest(it)?.apply {
                            this.ticketCode = ticket.ticketCode
                            this.validationStatus = ticket.validationStatus.name
                        }
                    }
                }
            }
        } catch (e: Exception) {
            // assuming no ticket was found for requestId, store a new one
            realm.writeBlocking {
                copyToRealm(TicketObject().apply {
                    this.requestId = ticket.requestId
                    this.ticketHash = ticket.ticketHash
                    this.ticketCode = ticket.ticketCode
                    this.validationStatus = ticket.validationStatus.name
                }, updatePolicy = io.realm.kotlin.UpdatePolicy.ALL)
            }
        } finally {
            _storedTickets.value = getAll()
        }
    }

    private fun getAll(): List<TicketObject> {
        return realm.query<TicketObject>().find()
    }

    fun getTicketByRequestId(requestId: Int): TicketObject? {
        return realm.query<TicketObject>("requestId == $0", requestId).first().find()
    }

    fun getTicketStatus(ticketCode: String): ValidationStatus? {
        val ticket = realm.query<TicketObject>("ticketCode == $0", ticketCode).first().find()
        return if (ticket != null) {
            ValidationStatus.valueOf(ticket.validationStatus)
        } else {
            null
        }
    }

    fun getTicketsByValidationStatus(status: ValidationStatus): RealmResults<TicketObject> {
        return realm.query<TicketObject>("validationStatus == $0", status.name).find()
    }
}
