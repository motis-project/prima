package de.motis.prima.data

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
}

data class TourDTO(
    var tourId: Int,
    var ticketValidated: Boolean,
    var fare: Int,
    var fareReported: Boolean
)

class TourStore @Inject constructor(private val realm: Realm) {

    private val _storedTours = MutableStateFlow(getAll())
    val storedTours = _storedTours.asStateFlow()

    suspend fun update(tour: TourDTO) {
        realm.write {
            copyToRealm(TourObject().apply {
                this.tourId = tour.tourId
                this.ticketValidated = tour.ticketValidated
                this.fare = tour.fare
                this.fareReported = tour. fareReported
            }, updatePolicy = io.realm.kotlin.UpdatePolicy.ALL)
        }
        _storedTours.value = getAll()
    }

    fun getAll(): List<TourObject> {
        return realm.query<TourObject>().find()
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
