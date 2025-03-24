package de.motis.prima.di

import android.content.Context
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import de.motis.prima.app.NotificationHelper
import de.motis.prima.data.CookieStore
import de.motis.prima.data.DataRepository
import de.motis.prima.data.DataStoreManager
import de.motis.prima.data.TicketStore
import de.motis.prima.data.TourStore
import de.motis.prima.services.ApiService
import io.realm.kotlin.Realm
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideCookieStore(@ApplicationContext context: Context): CookieStore {
        return CookieStore(context)
    }

    @Provides
    @Singleton
    fun provideDataStoreManager(@ApplicationContext context: Context): DataStoreManager {
        return DataStoreManager(context)
    }

    @Provides
    @Singleton
    fun provideTicketStore(realm: Realm): TicketStore {
        return TicketStore(realm)
    }

    @Provides
    @Singleton
    fun provideTourStore(realm: Realm): TourStore {
        return TourStore(realm)
    }

    @Provides
    @Singleton
    fun provideDataRepository(
        dataStoreManager: DataStoreManager,
        ticketStore: TicketStore,
        tourStore: TourStore,
        apiService: ApiService,
        notificationHelper: NotificationHelper
    ): DataRepository {
        return DataRepository(dataStoreManager, ticketStore, tourStore, apiService, notificationHelper)
    }

    @Provides
    @Singleton
    fun provideNotificationHelper(@ApplicationContext context: Context): NotificationHelper {
        return NotificationHelper(context)
    }
}
