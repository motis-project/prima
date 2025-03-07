package de.motis.prima.di

import android.content.Context
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import de.motis.prima.data.DataRepository
import de.motis.prima.data.DataStoreManager
import de.motis.prima.data.CookieStore
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
    fun provideDataRepository(dataStoreManager: DataStoreManager): DataRepository {
        return DataRepository(dataStoreManager)
    }
}
