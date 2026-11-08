package dev.pleorder.app;

/** A separate DO entry point. Never loads the parked catalog, settings or browser. */
public final class DrivingActivity extends MainActivity {
    @Override protected boolean drivingSurface(){return true;}
}
