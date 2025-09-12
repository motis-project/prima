package de.motis.prima.services

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import dagger.hilt.android.AndroidEntryPoint
import de.motis.prima.MainActivity
import de.motis.prima.R
import de.motis.prima.data.DataRepository
import de.motis.prima.data.DataStoreManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class FirebaseService: FirebaseMessagingService() {
    @Inject
    lateinit var apiService: ApiService

    @Inject
    lateinit var dataStore: DataStoreManager

    @Inject
    lateinit var repository: DataRepository

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

        val data = remoteMessage.data

        if (data.isNotEmpty()) {
            val tourId = data["tourId"]
            val pickupTime = data["pickupTime"]

            val title = remoteMessage.notification?.title ?: "Default Title"
            val body = remoteMessage.notification?.body ?: "Default Body"

            repository.fetchTours(pickupTime?.toLong())

            tourId?.let { tourIdStr ->
                repository.updateEventGroups(tourIdStr.toInt())
            }

            /*CoroutineScope(Dispatchers.IO).launch {
                try {
                    val msgVehicleId = data["vehicleId"]?.toInt()
                    dataStore.selectedVehicleFlow.collect { value ->
                        if (value.id == msgVehicleId) {
                            showNotification(title, body, tourId)
                        }
                    }
                } catch (e: Exception) {
                    Log.e("error", "Failed to retrieve stored vehicle id", e)
                }
            }*/
            showNotification(title, body, tourId, pickupTime?.toLong())
        }
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d("fcm", "Received new token")
        CoroutineScope(Dispatchers.IO).launch {
            try {
                dataStore.setDeviceInfo(token, true)
            } catch (e: Exception) {
                Log.e("fcm", "Failed to store token", e)
            }
        }
    }

    private fun showNotification(title: String?, body: String?, tourId: String?, pickupTime: Long?) {
        val intent = Intent(this, MainActivity::class.java).apply {
            putExtra("tourId", tourId)
            putExtra("pickupTime", pickupTime)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Ensure the Notification Channel is created for Android Oreo and above
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channelId = "default_channel_id"
            val channelName = "Default Channel"
            val channel = NotificationChannel(channelId, channelName, NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "Channel description"
            }
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }

        val notification = NotificationCompat.Builder(this, "default_channel_id")
            .setContentTitle(title)
            .setContentText(body)
            .setSmallIcon(R.drawable.ic_bell)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(0, notification)
    }
}