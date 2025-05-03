// Top-level build file where you can add configuration options common to all sub-projects/modules.
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.jetbrains.kotlin.android) apply false
    id("com.google.dagger.hilt.android") version "2.51.1" apply false
    id("io.realm.kotlin") version "1.13.0" apply false
    id("com.google.gms.google-services") version "4.4.2" apply false
}
