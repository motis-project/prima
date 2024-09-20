package com.example.opnvtaxi.services

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl

class CookieStore(context: Context) : CookieJar {
    private val preferences: SharedPreferences = context.getSharedPreferences("cookies", Context.MODE_PRIVATE)

    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        val editor = preferences.edit()
        val serializedCookie = cookies.joinToString(";") { cookie -> cookie.toString() }
        editor.putString(url.host, serializedCookie)
        editor.apply()
    }

    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        val cookiesString = preferences.getString(url.host, null)
        if (cookiesString.isNullOrEmpty()) {
            Log.d("Cookie", "No stored cookie found.")
            return listOf()
        }
        Log.d("cookie", "cookie is $cookiesString")

        val cookie = Cookie.parse(url, cookiesString)
        if (cookie == null) {
            Log.d("Cookie", "No cookie for host found.")
            return listOf()
        }
        return listOf(cookie)
    }

    fun clearCookies(host: String? = null) {
        val editor = preferences.edit()
        if (host != null) {
            editor.remove(host)
        } else {
            editor.clear()
        }
        editor.apply()
    }

    fun isEmpty(host: String): Boolean {
        return preferences.contains(host) && preferences.getString(host, null)?.isNotEmpty() == true
    }

    fun isEmpty(): Boolean {
        return preferences.all.isEmpty()
    }
}