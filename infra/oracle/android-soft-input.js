Java.perform(function () {
  const Activity = Java.use("android.app.Activity");
  const onResume = Activity.onResume.overload();
  const Instrumentation = Java.use("android.app.Instrumentation");
  const callActivityOnResume =
    Instrumentation.callActivityOnResume.overload("android.app.Activity");
  const Window = Java.use("android.view.Window");
  const setSoftInputMode = Window.setSoftInputMode.overload("int");

  function makeKeyboardSafe(activity) {
    Java.scheduleOnMainThread(function () {
      try {
        const window = activity.getWindow();
        const attributes = window.getAttributes();
        attributes.softInputMode.value = 0x10; // SOFT_INPUT_ADJUST_RESIZE
        window.setAttributes(attributes);
        window.setDecorFitsSystemWindows(true);
      } catch (error) {
        console.log("soft-input update failed: " + error);
      }
    });
  }

  setSoftInputMode.implementation = function () {
    return setSoftInputMode.call(this, 0x10);
  };

  onResume.implementation = function () {
    onResume.call(this);
    makeKeyboardSafe(this);
  };

  callActivityOnResume.implementation = function (activity) {
    callActivityOnResume.call(this, activity);
    makeKeyboardSafe(activity);
  };

  Java.choose("com.aurora.store.MainActivity", {
    onMatch: makeKeyboardSafe,
    onComplete: function () {
      console.log("soft-input resize applied");
    },
  });
});
