async function init() {
  await loadAssets();
  buildScene();
  buildCustomUI();
  applyBaseUI();
  setupPlayEntities();

  const startScreen = document.getElementById('startScreen');
  startScreen.addEventListener('click', () => {
    startScreen.style.display = 'none';
    if (activePlayerObj) {
      nodeRuntime.enableInput(renderer.domElement);
      try { renderer.domElement.requestPointerLock?.(); } catch (err) {}
    } else {
      enableFallbackFPS();
      try { renderer.domElement.requestPointerLock?.(); } catch (err) {}
    }
    if (isLikelyMobile) activateMobileUI();
    nodeRuntime.triggerEvent('OnStart', null);
  });

  document.body.addEventListener('click', (e) => {
    if (!inspectActive && !document.pointerLockElement && startScreen.style.display === 'none') {
      if (!e.target.closest('.mobile-joystick-area, .mobile-look-area, .mobile-interact-btn, .inspect-overlay')) {
        try { renderer.domElement.requestPointerLock?.(); } catch (err) {}
      }
    }
  });

  window.addEventListener('keydown', (e) => {
    if ((e.code === 'KeyE' || e.key?.toLowerCase() === 'e') && !inspectActive) {
      tryInteract();
    }
  });

  const clock = new THREE.Clock();
  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.1);

    if (activePlayerObj) {
      nodeRuntime.update(dt);
      updateInteraction();

      activePlayerObj.updateMatrixWorld(true);
      const childCam = activePlayerObj.children.find(c => (c.isCamera || c.userData?.type === 'camera') && !c.userData?.isGizmo)
        || sceneManagerAdapter.getChildren(activePlayerObj.userData.id).find(c => (c.isCamera || c.userData?.type === 'camera') && !c.userData?.isGizmo);

      if (childCam) {
        childCam.updateMatrixWorld(true);
        const worldPos = new THREE.Vector3();
        const worldQuat = new THREE.Quaternion();
        childCam.getWorldPosition(worldPos);
        childCam.getWorldQuaternion(worldQuat);
        camera.position.copy(worldPos);
        camera.quaternion.copy(worldQuat);
      }

      const radius = activePlayerObj.userData?.playerController?.playerRadius || 0.3;
      collisionAdapter.checkTriggers(camera.position, radius);
    } else if (activeCameraObj) {
      nodeRuntime.update(dt);
      updateInteraction();

      activeCameraObj.updateMatrixWorld(true);
      const worldPos = new THREE.Vector3();
      const worldQuat = new THREE.Quaternion();
      activeCameraObj.getWorldPosition(worldPos);
      activeCameraObj.getWorldQuaternion(worldQuat);
      camera.position.copy(worldPos);
      camera.quaternion.copy(worldQuat);

      collisionAdapter.checkTriggers(camera.position, 0.5);
    } else {
      updateFallbackFPS(dt);
      nodeRuntime.update(dt);
      updateInteraction();
    }

    renderer.render(scene, camera);
    if (inspectActive) iRenderer.render(inspectScene, iCam);
  }
  loop();
}

init();
