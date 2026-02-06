package de.motis.prima.data

import android.util.Log
import de.motis.prima.ui.Location
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
    var customerPhone: String? = null
    var address: String = ""
    var eventGroup: String = ""
    var isPickup: Boolean= false
    var lat: Double = 0.0
    var lng: Double = 0.0
    var scheduledTime: Long = 0
    var scheduledTimeStart: Long = 0
    var bikes: Int = 0
    var customer: Int = 0
    var luggage: Int = 0
    var passengers: Int = 0
    var wheelchairs: Int = 0
    var requestId: Int = 0
    var ticketHash: String = ""
    var ticketChecked: Boolean = false
    var cancelled: Boolean = false
    var ticketPrice: Int = 0
    var kidsZeroToTwo: Int = 0
    var kidsThreeToFour: Int = 0
    var kidsFiveToSix: Int = 0
}

data class EventObjectGroup(
    val id: String,
    val arrivalTime: Long,
    val location: Location,
    val address: String,
    val events: List<EventObject>,
    var stopIndex: Int,
    var hasPickup: Boolean,
    var cancelled: Boolean,
)

class TourStore @Inject constructor(
    private var realm: Realm
) {

    private val _storedTours = MutableStateFlow(getAll())
    val storedTours = _storedTours.asStateFlow()

    fun update(tour: Tour) {
        // update EventObjects
        try {
            realm.writeBlocking {
                for (event in tour.events) {
                    copyToRealm(EventObject().apply {
                        this.id = event.id
                        this.tour = event.tour
                        this.customerName = event.customerName
                        this.customerPhone = event.customerPhone
                        this.address = event.address
                        this.eventGroup = event.eventGroup
                        this.isPickup = event.isPickup
                        this.lat = event.lat
                        this.lng = event.lng
                        this.scheduledTime = event.scheduledTime
                        this.scheduledTimeStart = event.scheduledTimeStart
                        this.bikes = event.bikes
                        this.customer = event.customer
                        this.luggage = event.luggage
                        this.passengers = event.passengers
                        this.wheelchairs = event.wheelchairs
                        this.requestId = event.requestId
                        this.ticketHash = event.ticketHash
                        this.ticketChecked = event.ticketChecked
                        this.cancelled = event.cancelled
                        this.ticketPrice = event.ticketPrice
                        this.kidsZeroToTwo = event.kidsZeroToTwo
                        this.kidsThreeToFour = event.kidsThreeToFour
                        this.kidsFiveToSix = event.kidsFiveToSix
                    }, updatePolicy = io.realm.kotlin.UpdatePolicy.ALL)
                }
            }

            // update TourObjects
            try {
                val existingTour = realm.query<TourObject>("tourId == $0", tour.tourId).find().first()
                realm.writeBlocking {
                    existingTour.let {
                        findLatest(it)?.apply {
                            this.startTime = tour.startTime
                            this.endTime = tour.endTime
                            this.vehicleId = tour.vehicleId
                            this.fare = tour.fare
                            this.ticketValidated = tour.events.any { e -> e.isPickup && e.ticketChecked }
                        }
                    }
                }
            } catch (e: Exception) {
                // assuming no tour was found for tourId, store a new one
                realm.writeBlocking {
                    copyToRealm(TourObject().apply {
                        this.tourId = tour.tourId
                        this.startTime = tour.startTime
                        this.endTime = tour.endTime
                        this.vehicleId = tour.vehicleId
                        this.fare = tour.fare
                        this.ticketValidated = tour.events.any { e -> e.isPickup && e.ticketChecked }
                    }, updatePolicy = io.realm.kotlin.UpdatePolicy.ALL)
                }
            }
        } catch (e: Exception) {
            Log.d("db", e.message!!)
        }

        // update StateFlow
        _storedTours.value = getAll()
    }

    fun updateFare(tourId: Int, fareCent: Int, fareReported: Boolean) {
        realm.writeBlocking {
            val tour = realm.query<TourObject>("tourId == $0", tourId).find().first()
            tour.let { findLatest(it)?.apply {
                    this.fare = fareCent
                    this.fareReported = fareReported
                }
            }
        }
        _storedTours.value = getAll()
    }

    private fun getAll(): List<TourObject> {
        return realm.query<TourObject>().find()
    }

    fun getToursUnreportedFare(): List<TourObject> {
        return realm.query<TourObject>("fareReported == false").find()
    }

    fun getToursForInterval(start: Long, end: Long): List<Tour> {
        val tours = mutableListOf<Tour>()
        val tourObjects = realm.query<TourObject>("startTime > $0 AND endTime < $1", start, end).find()

        for (tour in tourObjects) {
            val events = mutableListOf<Event>()
            val eventObjects = getEventsForTour(tour.tourId)
            for (e in eventObjects) {
                events.add(Event(
                    id = e.id,
                    tour = e.tour,
                    customerName = e.customerName,
                    customerPhone = e.customerPhone,
                    address = e.address,
                    eventGroup = e.eventGroup,
                    isPickup = e.isPickup,
                    lat = e.lat,
                    lng = e.lng,
                    scheduledTime = e.scheduledTime,
                    scheduledTimeStart = e.scheduledTimeStart,
                    bikes = e.bikes,
                    customer = e.customer,
                    luggage = e.luggage,
                    passengers = e.passengers,
                    wheelchairs = e.wheelchairs,
                    requestId = e.requestId,
                    ticketHash = e.ticketHash,
                    ticketChecked = e.ticketChecked,
                    cancelled = e.cancelled,
                    ticketPrice = e.ticketPrice,
                    kidsZeroToTwo = e.kidsZeroToTwo,
                    kidsThreeToFour= e.kidsThreeToFour,
                    kidsFiveToSix = e.kidsFiveToSix
                ))
            }

            tours.add(Tour(
                tourId = tour.tourId,
                fare = tour.fare,
                startTime = tour.startTime,
                endTime = tour.endTime,
                vehicleId = tour.vehicleId,
                licensePlate = "",
                events = events
            ))
        }
        return tours
    }

    fun getEventsForTour(tourId: Int): List<EventObject> {
        return realm.query<EventObject>("tour == $0", tourId).find()
    }

    fun getEventGroupsForTour(tourId: Int): List<EventObjectGroup> {
        val events = realm.query<EventObject>("tour == $0", tourId).find()
        val eventGroups = mutableListOf<EventObjectGroup>()
        val groupIDs = mutableSetOf<String>()

        for (event in events) {
            groupIDs.add(event.eventGroup)
        }

        for (id in groupIDs) {
            val group = events.filter { e -> e.eventGroup == id }
            if (group.isNotEmpty()) {

                // all events in group cancelled -> eventGroup cancelled
                var cancelled = true
                for (e in group) {
                    if (!e.cancelled) cancelled = false
                }

                eventGroups.add(
                    EventObjectGroup(
                        group[0].eventGroup,
                        group[0].scheduledTimeStart,
                        Location(group[0].lat, group[0].lng),
                        group[0].address,
                        group,
                        stopIndex = 0,
                        hasPickup = false,
                        cancelled = cancelled
                    )
                )
            }
        }

        if (eventGroups.isNotEmpty()) {
            eventGroups.sortBy { it.arrivalTime }
            eventGroups.forEachIndexed { index, group ->
                group.stopIndex = index
                val pickupEvent = group.events.find { e -> e.isPickup }
                group.hasPickup = (pickupEvent != null)
            }
        }

        return eventGroups
    }

    fun getTour(id: Int): TourObject? {
        return realm.query<TourObject>("tourId == $0", id).first().find()
    }

    fun getPickupRequestIDs(tourId: Int): Set<Int> {
        val res: MutableSet<Int> = mutableSetOf()
        val pickupEvents = getEventsForTour(tourId).filter { e -> e.isPickup }

        for (e in pickupEvents) {
            res.add(e.requestId)
        }

        return res
    }
}
