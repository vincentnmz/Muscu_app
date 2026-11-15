# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile


# ── Novalyz (15/11/2026) : R8 activé sur le release ───────────────────────────
# Le pont Capacitor appelle les méthodes des extensions PAR LEUR NOM depuis le JavaScript : on garde
# intactes les classes du pont et de nos extensions (le reste — AndroidX, Firebase, Kotlin… — est
# optimisé et obscurci, c'est l'essentiel du code DEX).
-keep class com.getcapacitor.** { *; }
-keep class com.capacitorjs.plugins.** { *; }
-keep class io.capawesome.capacitorjs.plugins.** { *; }
-keep class com.fit_up.health.capacitor.** { *; }
-keep class com.novalyz.app.** { *; }
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod, SourceFile, LineNumberTable
# Health Connect : types d'enregistrements lus par réflexion Kotlin (KClass).
-keep class androidx.health.connect.client.records.** { *; }
-dontwarn org.apache.cordova.**
