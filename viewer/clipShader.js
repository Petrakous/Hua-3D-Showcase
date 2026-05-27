import * as THREE from "three";

const MAX_CLIP_VALUE = 1e6;
const UNIFORM_NEEDLE = "uniform int sceneCount;";
const CENTER_NEEDLE = "vec3 splatCenter = uintBitsToFloat(uvec3(sampledCenterColor.gba));";
const COLOR_NEEDLE = "vColor = uintToRGBAVec(sampledCenterColor.r);";
const FRAGMENT_VARYING_NEEDLE = `varying vec4 vColor;
            varying vec2 vUv;
            varying vec2 vPosition;`;
const FRAGMENT_COLOR_NEEDLE = "vec3 color = vColor.rgb;";

function installSplatShaderController(splatMesh) {
  const material = splatMesh?.material;
  if (!material?.vertexShader || !material.uniforms || !material.fragmentShader) {
    throw new Error("The splat material is not available yet.");
  }

  if (material.userData.splatShaderController) {
    return material.userData.splatShaderController;
  }

  const requiredNeedles = [
    material.vertexShader.includes(UNIFORM_NEEDLE),
    material.vertexShader.includes(CENTER_NEEDLE),
    material.vertexShader.includes(COLOR_NEEDLE),
    material.fragmentShader.includes(FRAGMENT_VARYING_NEEDLE),
    material.fragmentShader.includes(FRAGMENT_COLOR_NEEDLE),
  ];

  if (requiredNeedles.includes(false)) {
    throw new Error("Unable to patch the Gaussian Splat shader for clip-box support.");
  }

  material.uniforms.clipBoxMin = {
    value: new THREE.Vector3(-MAX_CLIP_VALUE, -MAX_CLIP_VALUE, -MAX_CLIP_VALUE),
  };
  material.uniforms.clipBoxMax = {
    value: new THREE.Vector3(MAX_CLIP_VALUE, MAX_CLIP_VALUE, MAX_CLIP_VALUE),
  };
  material.uniforms.clipBoxEnabled = {
    value: 1,
  };
  material.uniforms.orientedClipBoxCenter = {
    value: new THREE.Vector3(),
  };
  material.uniforms.orientedClipBoxHalfSize = {
    value: new THREE.Vector3(MAX_CLIP_VALUE, MAX_CLIP_VALUE, MAX_CLIP_VALUE),
  };
  material.uniforms.orientedClipBoxQuaternion = {
    value: new THREE.Vector4(0, 0, 0, 1),
  };
  material.uniforms.orientedClipBoxEnabled = {
    value: 0,
  };

  material.vertexShader = material.vertexShader
    .replace(
      UNIFORM_NEEDLE,
      `${UNIFORM_NEEDLE}
        uniform vec3 clipBoxMin;
        uniform vec3 clipBoxMax;
        uniform int clipBoxEnabled;
        uniform vec3 orientedClipBoxCenter;
        uniform vec3 orientedClipBoxHalfSize;
        uniform vec4 orientedClipBoxQuaternion;
        uniform int orientedClipBoxEnabled;`
    )
    .replace(
      "vec2 getDataUVF(in uint sIndex, in float stride, in uint offset, in vec2 dimensions) {",
      `vec3 rotateByQuaternion(in vec3 v, in vec4 q) {
            return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
        }

        vec2 getDataUVF(in uint sIndex, in float stride, in uint offset, in vec2 dimensions) {`
    )
    .replace(
      CENTER_NEEDLE,
      `${CENTER_NEEDLE}
            if (orientedClipBoxEnabled == 1) {
                vec3 clipLocalPoint = rotateByQuaternion(
                    splatCenter - orientedClipBoxCenter,
                    orientedClipBoxQuaternion
                );

                if (abs(clipLocalPoint.x) > orientedClipBoxHalfSize.x ||
                    abs(clipLocalPoint.y) > orientedClipBoxHalfSize.y ||
                    abs(clipLocalPoint.z) > orientedClipBoxHalfSize.z) {
                    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
                    return;
                }
            } else if (clipBoxEnabled == 1 &&
                (splatCenter.x < clipBoxMin.x || splatCenter.x > clipBoxMax.x ||
                 splatCenter.y < clipBoxMin.y || splatCenter.y > clipBoxMax.y ||
                 splatCenter.z < clipBoxMin.z || splatCenter.z > clipBoxMax.z)) {
                gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
                return;
            }`
    );

  material.needsUpdate = true;

  const controller = {
    updateClipBox(clipBox, enabled = true) {
      material.uniforms.clipBoxEnabled.value = enabled ? 1 : 0;
      material.uniforms.orientedClipBoxEnabled.value = 0;
      material.uniforms.clipBoxMin.value.set(clipBox.minX, clipBox.minY, clipBox.minZ);
      material.uniforms.clipBoxMax.value.set(clipBox.maxX, clipBox.maxY, clipBox.maxZ);
      material.uniformsNeedUpdate = true;
    },

    updateOrientedClipBox(boxConfig, enabled = true) {
      const position = boxConfig?.position || [0, 0, 0];
      const scale = boxConfig?.scale || [MAX_CLIP_VALUE, MAX_CLIP_VALUE, MAX_CLIP_VALUE];
      const rotationDegrees = boxConfig?.rotationDegrees || [0, 0, 0];
      const euler = new THREE.Euler(
        THREE.MathUtils.degToRad(rotationDegrees[0] || 0),
        THREE.MathUtils.degToRad(rotationDegrees[1] || 0),
        THREE.MathUtils.degToRad(rotationDegrees[2] || 0),
        "XYZ"
      );
      const quaternion = new THREE.Quaternion().setFromEuler(euler).invert();

      material.uniforms.clipBoxEnabled.value = 0;
      material.uniforms.orientedClipBoxEnabled.value = enabled ? 1 : 0;
      material.uniforms.orientedClipBoxCenter.value.set(position[0], position[1], position[2]);
      material.uniforms.orientedClipBoxHalfSize.value.set(
        Math.max(scale[0] || 0, 0.001) * 0.5,
        Math.max(scale[1] || 0, 0.001) * 0.5,
        Math.max(scale[2] || 0, 0.001) * 0.5
      );
      material.uniforms.orientedClipBoxQuaternion.value.set(
        quaternion.x,
        quaternion.y,
        quaternion.z,
        quaternion.w
      );
      material.uniformsNeedUpdate = true;
    },
  };

  material.userData.splatShaderController = controller;
  return controller;
}

export { installSplatShaderController };
