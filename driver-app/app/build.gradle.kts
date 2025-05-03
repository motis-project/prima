plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.jetbrains.kotlin.android)
    id("com.google.dagger.hilt.android")
    kotlin("kapt")
    id("io.realm.kotlin")
    //id("com.android.application")
    id("com.google.gms.google-services")
}

android {
    namespace = "de.motis.prima"
    compileSdk = 34

    defaultConfig {
        applicationId = "de.motis.prima"
        minSdk = 27
        //noinspection OldTargetApi
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        debug {
            buildConfigField("String", "BASE_URL", "\"https://app.primaplusoev.de\"")
            //buildConfigField("String", "BASE_URL", "\"http://82.165.178.73:8000\"")
        }
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            buildConfigField("String", "BASE_URL", "\"https://app.primaplusoev.de\"")
        }
    }
    buildFeatures {
        buildConfig = true
        compose = true
    }
    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.0"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
    kotlinOptions {
        jvmTarget = "1.8"
    }
}

dependencies {
    implementation(libs.core)
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.androidx.runtime.android)

    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.hilt.navigation.compose)
    implementation (libs.androidx.activity.compose)
    implementation(libs.androidx.constraintlayout.compose)
    implementation(libs.androidx.material3.android)
    implementation(libs.material)

    implementation(platform("com.google.firebase:firebase-bom:33.12.0"))

    implementation(libs.realm)

    implementation(libs.hilt.android)
    implementation(libs.androidx.activity.ktx)
    implementation(libs.firebase.messaging.ktx)
    kapt(libs.hilt.compiler)
    implementation(libs.kotlin.stdlib)

    implementation(libs.okhttp)
    implementation(libs.retrofit)

    implementation(libs.androidx.datastore.preferences.core.jvm)
    implementation(libs.androidx.datastore.preferences)
    implementation(libs.converter.gson)

    implementation(libs.androidx.camera.core)
    implementation(libs.androidx.camera.lifecycle)
    implementation(libs.androidx.camera.view)
    implementation(libs.androidx.camera.camera2)
    implementation(libs.mlkit.barcode.scanning)

    implementation(libs.play.services.location)
    implementation(libs.androidx.runtime.livedata)

    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
}
