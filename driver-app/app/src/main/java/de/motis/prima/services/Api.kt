package de.motis.prima.services

import de.motis.prima.BuildConfig.BASE_URL
import retrofit2.Call
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
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
    ): ApiResponse

    @GET("api/driver/vehicle")
    fun getVehicles() : Call<List<Vehicle>>

    @GET("api/driver/tour")
    fun getTours(@Query("fromTime") fromTime: Long, @Query("toTime") toTime: Long) : Call<List<Tour>>

    @PUT("api/driver/ticket")
    suspend fun validateTicket(
        @Query("requestId") requestId: Int,
        @Query("ticketCode") ticketCode: String
    ): ApiResponse

    @PUT("api/driver/fare")
    suspend fun reportFare(
        @Query("tourId") tourId: Int,
        @Query("fare") fare: Int
    ): ApiResponse
}

object Api {
    private val retrofit: Retrofit = Retrofit.Builder()
        .baseUrl(BASE_URL)
        .client(okHttpClient().build())
        .addConverterFactory(GsonConverterFactory.create())
        .build()

    val apiService: ApiService = retrofit.create(ApiService::class.java)
}

data class ApiResponse(
    val status: Int
)

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
