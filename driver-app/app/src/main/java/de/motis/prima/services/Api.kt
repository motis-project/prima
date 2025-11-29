package de.motis.prima.services

import retrofit2.Call
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.Field
import retrofit2.http.FormUrlEncoded
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Query

interface ApiService {
    @POST("account/login")
    @FormUrlEncoded
    suspend fun login(
        @Field("email") email: String,
        @Field("password") password: String
    ): Response<Void>

    @GET("api/driver/vehicle")
    fun getVehicles(): Call<List<Vehicle>>

    @GET("api/driver/tour")
    suspend fun getTours(
        @Query("fromTime") fromTime: Long,
        @Query("toTime") toTime: Long
    ): Response<List<Tour>>

    @PUT("api/driver/ticket")
    suspend fun validateTicket(
        @Query("requestId") requestId: Int,
        @Query("ticketCode") ticketCode: String
    ): Response<Void>

    @PUT("api/driver/fare")
    suspend fun reportFare(
        @Query("tourId") tourId: Int,
        @Query("fare") fare: Int
    ): Response<Void>

    @PUT("api/driver/token")
    suspend fun sendDeviceInfo(
        @Query("deviceId") deviceId: String,
        @Query("token") token: String
    ): Response<Void>

    @POST("api/driver/availability")
    suspend fun getAvailability(
        @Body request: AvailabilityRequest
    ): Response<AvailabilityResponse>

    @DELETE("api/driver/availability")
    suspend fun deleteAvailability(
        @Body request: AvailabilityRequest
    ): Response<AvailabilityResponse>

    @PUT("/taxi/availability")
    suspend fun setAvailability(
        // {vehicleId: 1, from: 1760104800000, to: 1760106600000}
        @Query("vehicleId") vehicleId: String,
        @Query("from") from: String,
        @Query("to") to: String
    ): Response<Void>
}

data class AvailabilityRequest(
    val vehicleId: Int,
    val from: List<Long>,
    val to: List<Long>,
    val add: List<Boolean>,
    val offset: Int,
    val date: String
)

data class AvailabilityResponse(
    val tours: List<Tour> = emptyList(),
    val vehicles: List<Vehicle> = emptyList(),
    val from: List<Long> = emptyList(),
    val to: List<Long> = emptyList(),
    val add: List<Boolean> = emptyList()
)

data class Availability(
    val id: Int,
    val startTime: Long,
    val endTime: Long,
)

data class Vehicle(
    val id: Int,
    val licensePlate: String,
    val availability: List<Availability> = emptyList()
)

data class Event(
    val tour: Int,
    val customerName: String,
    val customerPhone: String?,
    val id: Int,
    val address: String,
    val eventGroup: String,
    val isPickup: Boolean,
    val lat: Double,
    val lng: Double,
    val scheduledTime: Long,
    val scheduledTimeStart: Long,
    val bikes: Int,
    val customer: Int,
    val luggage: Int,
    val passengers: Int,
    val wheelchairs: Int,
    val requestId: Int,
    val ticketHash: String,
    val ticketChecked: Boolean,
    val cancelled: Boolean,
    val ticketPrice: Int,
    val kidsZeroToTwo: Int,
    val kidsThreeToFour: Int,
    val kidsFiveToSix: Int,
)

data class Tour(
    val tourId: Int,
    val fare: Int,
    val startTime: Long,
    val endTime: Long,
    val vehicleId: Int,
    val licensePlate: String,
    val events: List<Event>
)
