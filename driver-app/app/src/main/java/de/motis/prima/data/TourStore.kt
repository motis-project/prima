package de.motis.prima.data

import android.util.Log
import de.motis.prima.Location
import de.motis.prima.services.Event
import de.motis.prima.services.Tour
import io.realm.kotlin.Realm
import io.realm.kotlin.ext.query
import io.realm.kotlin.types.RealmObject
import io.realm.kotlin.types.annotations.PrimaryKey
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject

class TourObject : RealmObject {
    @PrimaryKey
    var tourId: Int = 0
    var ticketValidated: Boolean = false
    var fare: Int = 0
    var fareReported: Boolean = false
    var startTime: Long = 0
    var endTime: Long = 0
    var vehicleId: Int = 0
}

class EventObject : RealmObject {
    @PrimaryKey
    var id: Int = 0
    var tour: Int = 0
    var customerName: String = ""
    var customerPhone: String = ""
    var communicatedTime: Long = 0
    var address: String = ""
    var eventGroup: String = ""
    var isPickup: Boolean= false
    var lat: Double = 0.0
    var lng: Double = 0.0
    var nextLegDuration: Long = 0
    var prevLegDuration: Long = 0
    var scheduledTimeStart: Long = 0
    var scheduledTimeEnd: Long = 0
    var bikes: Int = 0
    var customer: Int = 0
    var luggage: Int = 0
    var passengers: Int = 0
    var wheelchairs: Int = 0
    var requestId: Int = 0
    var ticketHash: String = ""
    var ticketChecked: Boolean = false
}

data class EventObjectGroup(
    val id: String,
    val arrivalTime: Long,
    val location: Location,
    val address: String,
    val events: List<EventObject>,
    var stopIndex: Int,
    var hasPickup: Boolean
)

class TourStore @Inject constructor(private var realm: Realm) {

    private val _storedTours = MutableStateFlow(getAll())
    val storedTours = _storedTours.asStateFlow()

    suspend fun update(tour: Tour, ticketValidated: Boolean, fareReported: Boolean) {
        realm.write {
            for (event in tour.events) {
                copyToRealm(EventObject().apply {
                    this.id = event.id
                    this.tour = event.tour
                    this.customerName = event.customerName
                    this.customerPhone = event.customerPhone
                    this.communicatedTime = event.communicatedTime
                    this.address = event.address
                    this.eventGroup = event.eventGroup
                    this.isPickup = event.isPickup
                    this.lat = event.lat
                    this.lng = event.lng
                    this.nextLegDuration = event.nextLegDuration
                    this.prevLegDuration = event.prevLegDuration
                    this.scheduledTimeStart = event.scheduledTimeStart
                    this.scheduledTimeEnd = event.scheduledTimeEnd
                    this.bikes = event.bikes
                    this.customer = event.customer
                    this.luggage = event.luggage
                    this.passengers = event.passengers
                    this.wheelchairs = event.wheelchairs
                    this.requestId = event.requestId
                    this.ticketHash = event.ticketHash
                    this.ticketChecked = event.ticketChecked
                }, updatePolicy = io.realm.kotlin.UpdatePolicy.ALL)
            }
        }

        realm.write {
            copyToRealm(TourObject().apply {
                this.tourId = tour.tourId
                this.ticketValidated = ticketValidated
                this.fare = tour.fare
                this.fareReported = fareReported
                this.startTime = tour.startTime
                this.endTime = tour.endTime
                this.vehicleId = tour.vehicleId
            }, updatePolicy = io.realm.kotlin.UpdatePolicy.ALL)
        }
        _storedTours.value = getAll()
    }

    suspend fun updateFare(tourId: Int, fareCent: Int, fareReported: Boolean) {
        realm.write {
            copyToRealm(TourObject().apply {
                this.tourId = tourId
                this.fare = fareCent
                this.fareReported = fareReported
            }, updatePolicy = io.realm.kotlin.UpdatePolicy.ALL)
        }
        _storedTours.value = getAll()
    }

    private fun getAll(): List<TourObject> {
        return realm.query<TourObject>().find()
    }

    fun getToursUnreportedFare(): List<TourObject> {
        return realm.query<TourObject>("fareReported == false AND fare != 0").find()
    }

    fun getToursForInterval(start: Long, end: Long): List<Tour> {
        var tours = mutableListOf<Tour>()
        val tourObjects = realm.query<TourObject>("startTime > $0 AND endTime < $1", start, end).find()
        Log.d("foo", "${tourObjects.size}")
        for (tour in tourObjects) {
            val events = mutableListOf<Event>()
            val eventObjects = getEventsForTour(tour.tourId)
            for (e in eventObjects) {
                events.add(Event(
                    id = e.id,
                    tour = e.tour,
                    customerName = e.customerName,
                    customerPhone = e.customerPhone,
                    communicatedTime = e.communicatedTime,
                    address = e.address,
                    eventGroup = e.eventGroup,
                    isPickup = e.isPickup,
                    lat = e.lat,
                    lng = e.lng,
                    nextLegDuration = e.nextLegDuration,
                    prevLegDuration = e.prevLegDuration,
                    scheduledTimeStart = e.scheduledTimeStart,
                    scheduledTimeEnd = e.scheduledTimeEnd,
                    bikes = e.bikes,
                    customer = e.customer,
                    luggage = e.luggage,
                    passengers = e.passengers,
                    wheelchairs = e.wheelchairs,
                    requestId = e.requestId,
                    ticketHash = e.ticketHash,
                    ticketChecked = e.ticketChecked
                ))
            }

            tours.add(Tour(
                tourId = tour.tourId,
                fare = tour.fare,
                startTime = tour.startTime,
                endTime = tour.endTime,
                "",
                companyAddress = "",
                vehicleId = tour.vehicleId,
                licensePlate = "",
                events = events
            ))
        }
        return tours
    }

    private fun getEventsForTour(tourId: Int): List<EventObject> {
        return realm.query<EventObject>("tour == $0", tourId).find()
    }

    fun getEventGroupsForTour(tourId: Int): List<EventObjectGroup> {
        val events = realm.query<EventObject>("tour == $0", tourId).find()
        Log.d("test", "${tourId}")
        Log.d("test", "${events.size}")
        val tmpEventGroups = mutableListOf<EventObjectGroup>()
        val groupIDs = mutableSetOf<String>()

        for (event in events) {
            groupIDs.add(event.eventGroup)
        }

        for (id in groupIDs) {
            val group = events.filter { e -> e.eventGroup == id }
            if (group.isNotEmpty()) {
                tmpEventGroups.add(
                    EventObjectGroup(
                        group[0].eventGroup,
                        group[0].scheduledTimeStart,
                        Location(group[0].lat, group[0].lng),
                        group[0].address,
                        group,
                        0,
                        false
                    )
                )
            }
        }

        if (tmpEventGroups.isNotEmpty()) {
            tmpEventGroups.sortBy { it.arrivalTime }
            tmpEventGroups.forEachIndexed { index, group ->
                group.stopIndex = index
                val pickupEvent = group.events.find { e -> e.isPickup }
                group.hasPickup = (pickupEvent != null)
            }
        }

        return tmpEventGroups
    }

    suspend fun deleteTour(requestId: String) {
        realm.write {
            val tour = query<TourObject>("id == $0", requestId).first().find()
            tour?.let { delete(it) }
        }
    }

    fun clear() {
        realm.writeBlocking {
            deleteAll()
        }
    }
}
