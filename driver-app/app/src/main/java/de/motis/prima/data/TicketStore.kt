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
    CHECKED_IN, DONE, REJECTED
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
    var validationStatus: String = ""
}

class TicketStore @Inject constructor(private val realm: Realm) {

    private val _storedTickets = MutableStateFlow(getAll())
    val storedTickets = _storedTickets.asStateFlow()

    suspend fun update(ticket: Ticket) {
        realm.write {
            copyToRealm(TicketObject().apply {
                this.requestId = ticket.requestId
                this.ticketHash = ticket.ticketHash
                this.ticketCode = ticket.ticketCode
                this.validationStatus = ticket.validationStatus.name
            }, updatePolicy = io.realm.kotlin.UpdatePolicy.ALL)
        }
        _storedTickets.value = getAll()
    }

    fun getAll(): List<TicketObject> {
        return realm.query<TicketObject>().find()
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

    suspend fun deleteTicket(requestId: String) {
        realm.write {
            val ticket = query<TicketObject>("id == $0", requestId).first().find()
            ticket?.let { delete(it) }
        }
    }

    fun clear() {
        realm.writeBlocking {
            deleteAll()
        }
    }
}
