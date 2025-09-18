package de.motis.prima.di

import android.app.ActivityManager
import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import de.motis.prima.data.EventObject
import de.motis.prima.data.TicketObject
import de.motis.prima.data.TourObject
import io.realm.kotlin.Realm
import io.realm.kotlin.RealmConfiguration
import javax.inject.Singleton
import kotlin.system.exitProcess

@Module
@InstallIn(SingletonComponent::class)
object RealmModule {

    @Provides
    @Singleton
    fun provideRealmConfiguration(): RealmConfiguration {
        return RealmConfiguration.Builder(
            setOf(
                TicketObject::class,
                TourObject::class,
                EventObject::class
            )).build()
    }

    @Provides
    @Singleton
    fun provideRealm(realmConfiguration: RealmConfiguration, @ApplicationContext context: Context): Realm {
        //Realm.deleteRealm(realmConfiguration) //TODO: revise
        return try {
            Realm.open(realmConfiguration)
        } catch (e: Exception) {
            handleRealmFailure(context, e)
            throw e // Hilt still expects a Realm, so rethrow after handling
        }
    }

    private fun handleRealmFailure(context: Context, e: Exception) {
        Log.e("error", "${e.message}")
        val channelId = "realm_error_channel"
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val channel = NotificationChannel(
            channelId,
            "App Errors",
            NotificationManager.IMPORTANCE_HIGH
        )
        manager.createNotificationChannel(channel)

        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(android.R.drawable.stat_notify_error)
            .setContentTitle("App Error")
            .setContentText("Database failed to open.")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()

        manager.notify(1001, notification)

        // post to main thread since this code runs on Hilt init
        Handler(Looper.getMainLooper()).post {
            if (context is Application) {
                val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
                activityManager.appTasks.forEach { it.finishAndRemoveTask() }
            }
            exitProcess(0)
        }
    }
}
