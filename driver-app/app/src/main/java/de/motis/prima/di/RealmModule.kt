package de.motis.prima.di

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import de.motis.prima.data.TicketObject
import de.motis.prima.data.TourObject
import io.realm.kotlin.Realm
import io.realm.kotlin.RealmConfiguration
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object RealmModule {

    @Provides
    @Singleton
    fun provideRealmConfiguration(): RealmConfiguration {
        return RealmConfiguration.Builder(
            setOf(
                TicketObject::class,
                TourObject::class
            )).build()
    }

    @Provides
    @Singleton
    fun provideRealm(realmConfiguration: RealmConfiguration): Realm {
        //Realm.deleteRealm(realmConfiguration)
        return Realm.open(realmConfiguration)
    }
}
