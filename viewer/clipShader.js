import * as THREE from "three";

const MAX_CLIP_VALUE = 1e6;
const DEFAULT_ORIENTED_CLIP_FADE_WIDTH = 0.12;
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
    throw new Error("Unable to patch the Gaussian Splat shader for clip-box and normal visibility.");
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
  material.uniforms.orientedClipBoxFadeWidth = {
    value: DEFAULT_ORIENTED_CLIP_FADE_WIDTH,
  };
  material.uniforms.normalTexture = {
    value: null,
  };
  material.uniforms.normalTextureSize = {
    value: new THREE.Vector2(1, 1),
  };
  material.uniforms.normalTextureAvailable = {
    value: 0,
  };
  material.uniforms.backfaceCullingEnabled = {
    value: 0,
  };
  material.uniforms.invertBackfaceNormals = {
    value: 0,
  };
  material.uniforms.backfaceThreshold = {
    value: 0.0,
  };
  material.uniforms.backfaceFadeWidth = {
    value: 0.18,
  };
  material.uniforms.backfaceUseSoftFade = {
    value: 1,
  };
  material.uniforms.normalDebugEnabled = {
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
        uniform int orientedClipBoxEnabled;
        uniform float orientedClipBoxFadeWidth;
        uniform sampler2D normalTexture;
        uniform vec2 normalTextureSize;
        uniform int normalTextureAvailable;
        uniform int backfaceCullingEnabled;
        uniform int invertBackfaceNormals;
        uniform float backfaceThreshold;
        uniform float backfaceFadeWidth;
        uniform int backfaceUseSoftFade;
        uniform int normalDebugEnabled;`
    )
    .replace(
      "varying vec4 vColor;\n        varying vec2 vUv;\n        varying vec2 vPosition;",
      `varying vec4 vColor;
        varying vec2 vUv;
        varying vec2 vPosition;
        varying vec3 vNormalDebugColor;
        varying float vNormalDebugMix;
        varying float vClipVisibility;`
    )
    .replace(
      "vec2 getDataUVF(in uint sIndex, in float stride, in uint offset, in vec2 dimensions) {",
      `vec2 getIndexTextureUV(in uint sIndex, in vec2 dimensions) {
            float x = mod(float(sIndex), dimensions.x);
            float y = floor(float(sIndex) / dimensions.x);
            return (vec2(x, y) + 0.5) / dimensions;
        }

        vec3 rotateByQuaternion(in vec3 v, in vec4 q) {
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
            } else if (clipBoxEnabled == 1 &&
                (splatCenter.x < clipBoxMin.x || splatCenter.x > clipBoxMax.x ||
                 splatCenter.y < clipBoxMin.y || splatCenter.y > clipBoxMax.y ||
                 splatCenter.z < clipBoxMin.z || splatCenter.z > clipBoxMax.z)) {
                gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
                return;
            }`
    )
    .replace(
      COLOR_NEEDLE,
      `${COLOR_NEEDLE}
            vNormalDebugColor = vec3(0.0, 0.0, 0.0);
            vNormalDebugMix = 0.0;
            vClipVisibility = 1.0;

            if (orientedClipBoxEnabled == 1) {
                vec3 clipLocalPoint = rotateByQuaternion(
                    splatCenter - orientedClipBoxCenter,
                    orientedClipBoxQuaternion
                );
                vec3 outsideDistance = abs(clipLocalPoint) - orientedClipBoxHalfSize;
                float maxOutsideDistance = max(max(outsideDistance.x, outsideDistance.y), outsideDistance.z);

                if (maxOutsideDistance > 0.0) {
                    float fadeWidth = max(orientedClipBoxFadeWidth, 0.0001);
                    vClipVisibility = 1.0 - smoothstep(0.0, fadeWidth, maxOutsideDistance);
                }
            }

            if (vClipVisibility <= 0.001) {
                gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
                return;
            }

            vColor.a *= vClipVisibility;

            if (normalTextureAvailable == 1 && (backfaceCullingEnabled == 1 || normalDebugEnabled == 1)) {
                vec4 encodedNormalSample = texture(normalTexture, getIndexTextureUV(splatIndex, normalTextureSize));

                if (encodedNormalSample.a > 0.0) {
                    vec3 splatNormal = normalize((encodedNormalSample.xyz * 2.0) - 1.0);

                    if (invertBackfaceNormals == 1) {
                        splatNormal *= -1.0;
                    }

                    vNormalDebugColor = (splatNormal * 0.5) + 0.5;
                    vNormalDebugMix = float(normalDebugEnabled);

                    if (backfaceCullingEnabled == 1) {
                        vec3 transformedNormal = mat3(transformModelViewMatrix) * splatNormal;
                        float transformedNormalLength = max(length(transformedNormal), 0.000001);
                        vec3 viewNormal = transformedNormal / transformedNormalLength;

                        vec3 directionToCamera = -viewCenter.xyz;
                        float directionToCameraLength = max(length(directionToCamera), 0.000001);
                        vec3 viewDirectionToCamera = directionToCamera / directionToCameraLength;

                        float facingDot = dot(viewNormal, viewDirectionToCamera);
                        float visibility = 1.0;

                        if (backfaceUseSoftFade == 1) {
                            float effectiveFadeWidth = max(backfaceFadeWidth, 0.0001);
                            visibility = smoothstep(backfaceThreshold - effectiveFadeWidth,
                                                    backfaceThreshold + effectiveFadeWidth,
                                                    facingDot);
                        } else {
                            visibility = step(backfaceThreshold, facingDot);
                        }

                        if (visibility <= 0.001) {
                            gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
                            return;
                        }

                        vColor.a *= visibility;
                    }
                }
            }`
    );

  material.fragmentShader = material.fragmentShader
    .replace(
      FRAGMENT_VARYING_NEEDLE,
      `${FRAGMENT_VARYING_NEEDLE}
            varying vec3 vNormalDebugColor;
            varying float vNormalDebugMix;
            varying float vClipVisibility;`
    )
    .replace(
      FRAGMENT_COLOR_NEEDLE,
      "vec3 color = mix(vColor.rgb, vNormalDebugColor, vNormalDebugMix);"
    );

  material.needsUpdate = true;

  const controller = {
    setNormalTexture(texture, textureWidth, textureHeight) {
      material.uniforms.normalTexture.value = texture;
      material.uniforms.normalTextureSize.value.set(textureWidth, textureHeight);
      material.uniforms.normalTextureAvailable.value = texture ? 1 : 0;
      material.uniformsNeedUpdate = true;
    },

    clearNormalTexture() {
      material.uniforms.normalTexture.value = null;
      material.uniforms.normalTextureSize.value.set(1, 1);
      material.uniforms.normalTextureAvailable.value = 0;
      material.uniforms.backfaceCullingEnabled.value = 0;
      material.uniforms.normalDebugEnabled.value = 0;
      material.uniformsNeedUpdate = true;
    },

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
      material.uniforms.orientedClipBoxFadeWidth.value = boxConfig?.cutFadeWidth ?? DEFAULT_ORIENTED_CLIP_FADE_WIDTH;
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

    updateBackfaceSettings(settings, normalsAvailable) {
      const nextSettings = {
        enabled: false,
        invertNormals: false,
        threshold: 0.16,
        fadeWidth: 0.1,
        softFade: true,
        normalDebug: false,
        ...(settings || {}),
      };

      material.uniforms.backfaceCullingEnabled.value = normalsAvailable && nextSettings.enabled ? 1 : 0;
      material.uniforms.invertBackfaceNormals.value = nextSettings.invertNormals ? 1 : 0;
      material.uniforms.backfaceThreshold.value = nextSettings.threshold;
      material.uniforms.backfaceFadeWidth.value = nextSettings.fadeWidth;
      material.uniforms.backfaceUseSoftFade.value = nextSettings.softFade ? 1 : 0;
      material.uniforms.normalDebugEnabled.value = normalsAvailable && nextSettings.normalDebug ? 1 : 0;
      material.uniformsNeedUpdate = true;
    },
  };

  material.userData.splatShaderController = controller;
  return controller;
}

export { installSplatShaderController };
