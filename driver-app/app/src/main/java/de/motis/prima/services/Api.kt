package de.motis.prima.services

import de.motis.prima.BuildConfig.BASE_URL
import retrofit2.Call
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Field
import retrofit2.http.FormUrlEncoded
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Query
import java.util.Date

interface ApiService {
    @POST("login")
    @FormUrlEncoded
    suspend fun login(
        @Field("email") email: String,
        @Field("password") password: String
    ): LoginResponse

    @GET("api/vehicle")
    fun getVehicles() : Call<List<Vehicle>>

    @GET("api/tour")
    fun getTours(@Query("date") currentDate: String) : Call<List<Tour>>
}

object Api {
    private val retrofit: Retrofit = Retrofit.Builder()
        .baseUrl(BASE_URL)
        .client(okHttpClient().build())
        .addConverterFactory(GsonConverterFactory.create())
        .build()

    val apiService: ApiService = retrofit.create(ApiService::class.java)
}

data class LoginResponse(
    val type: String,
    val status: Int,
    val data: String
)

data class Vehicle(
    val id: Int,
    val license_plate: String,
    val company: Int,
    val seats: Int,
    val wheelchair_capacity: Int,
    val bike_capacity: Int,
    val storage_space: Int
)

data class Event(
    val address: Int,
    val latitude: Double,
    val longitude: Double,
    val street: String,
    val postal_code: String,
    val city: String,
    val scheduled_time: String,
    val house_number: String,
    val first_name: String,
    val last_name: String,
    val phone: String,
    val is_pickup: Boolean,
    val customer_id: String
)

data class Tour(
    val tour_id: Int,
    val from: String,
    val to: String,
    val vehicle_id: Int,
    val license_plate: String,
    val company_id: Int,
    val fare: Int,
    val fare_route: Int,
    val company_name: String,
    val events: List<Event>
)
