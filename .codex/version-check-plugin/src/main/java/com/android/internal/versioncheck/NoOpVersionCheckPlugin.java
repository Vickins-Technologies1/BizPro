package com.android.internal.versioncheck;

import org.gradle.api.Plugin;
import org.gradle.api.Project;

public class NoOpVersionCheckPlugin implements Plugin<Project> {
    @Override
    public void apply(Project project) {
        // Intentionally empty. AGP only needs the plugin id to exist in this offline build.
    }
}
