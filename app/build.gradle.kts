import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Keep signing material outside the repository; CI may provide another path.
val releaseSigningFile = providers.environmentVariable("AURA_SIGNING_PROPERTIES")
    .orNull?.let { file(it) }
    ?: rootProject.projectDir.parentFile.resolve("signing/AuraMusic/signing.properties")
val releaseSigning = Properties().apply {
    if (releaseSigningFile.isFile) releaseSigningFile.inputStream().use { load(it) }
}
val hasReleaseSigning = listOf("storeFile", "storePassword", "keyAlias", "keyPassword")
    .all { !releaseSigning.getProperty(it).isNullOrBlank() }

android {
    namespace = "com.jelly.audio"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.salt.music"
        minSdk = 26
        targetSdk = 34
        versionCode = 14
        versionName = "1.3.0"
        manifestPlaceholders["appLabel"] = "@string/app_name"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = file(releaseSigning.getProperty("storeFile"))
                storePassword = releaseSigning.getProperty("storePassword")
                keyAlias = releaseSigning.getProperty("keyAlias")
                keyPassword = releaseSigning.getProperty("keyPassword")
            }
        }
    }
    buildTypes {
        debug {
            if (providers.gradleProperty("auraPreview").isPresent) {
                applicationIdSuffix = ".preview"
                manifestPlaceholders["appLabel"] = "灵音预览"
            }
        }
        release {
            if (hasReleaseSigning) signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

// Keep the APK's resource inventory in sync with the exact files being packaged.
// Increment auraWebVersion for a new bundled UI; web-only releases use the publisher CLI.
val generateUpdateBase by tasks.registering(Exec::class) {
    val webVersion = providers.gradleProperty("auraWebVersion").orElse("1")
    val nativeVersion = android.defaultConfig.versionCode!!
    inputs.dir("src/main/assets/web")
    inputs.file(rootProject.file("scripts/updates/package.cjs"))
    inputs.property("webVersion", webVersion)
    inputs.property("nativeVersion", nativeVersion)
    outputs.file("src/main/assets/update-base.json")
    workingDir(rootProject.projectDir)
    commandLine("node", "scripts/updates/package.cjs", "--mode", "base",
        "--web-version", webVersion.get(), "--native-min", nativeVersion.toString(),
        "--native-max", nativeVersion.toString())
}
tasks.named("preBuild").configure { dependsOn(generateUpdateBase) }

// Never accidentally distribute an unsigned release when local secrets are absent.
gradle.taskGraph.whenReady {
    if (!hasReleaseSigning && allTasks.any { it.name == "packageRelease" || it.name == "signReleaseBundle" }) {
        throw GradleException("Release signing is missing. Set AURA_SIGNING_PROPERTIES to an external signing.properties file.")
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.10.0")
    testImplementation("org.json:json:20240303")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test:runner:1.5.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")
    implementation("androidx.media:media:1.7.0")
    implementation("androidx.media3:media3-exoplayer:1.2.1")
    implementation("androidx.media3:media3-datasource-okhttp:1.2.1")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.google.code.gson:gson:2.10.1")
}
