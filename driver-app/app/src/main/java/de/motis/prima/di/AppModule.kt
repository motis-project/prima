package de.motis.prima.di

import android.content.Context
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import de.motis.prima.data.DataStoreManager
import de.motis.prima.data.UserPreferencesRepository
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideDataStoreManager(@ApplicationContext context: Context): DataStoreManager {
        return DataStoreManager(context)
    }

    @Provides
    @Singleton
    fun provideUserPreferencesRepository(dataStoreManager: DataStoreManager): UserPreferencesRepository {
        return UserPreferencesRepository(dataStoreManager)
    }
}
