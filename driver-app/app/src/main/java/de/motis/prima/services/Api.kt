package de.motis.prima.services

import retrofit2.Call
import retrofit2.Response
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
}

data class Vehicle(
    val id: Int,
    val licensePlate: String
)

data class Event(
    val tour: Int,
    val customerName: String,
    val customerPhone: String,
    val id: Int,
    val communicatedTime: Long,
    val address: String,
    val eventGroup: String,
    val isPickup: Boolean,
    val lat: Double,
    val lng: Double,
    val nextLegDuration: Long,
    val prevLegDuration: Long,
    val scheduledTimeStart: Long,
    val scheduledTimeEnd: Long,
    val bikes: Int,
    val customer: Int,
    val luggage: Int,
    val passengers: Int,
    val wheelchairs: Int,
    val requestId: Int,
    val ticketHash: String
)

data class Tour(
    val tourId: Int,
    val fare: Int,
    val startTime: String,
    val endTime: String,
    val companyName: String,
    val companyAddress: String,
    val vehicleId: Int,
    val licensePlate: String,
    val events: List<Event>
)
