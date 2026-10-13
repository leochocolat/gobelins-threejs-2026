import {
    BoxGeometry,
    Mesh,
    MeshBasicMaterial,
    Scene,
    PlaneGeometry,
    Fog,
    CanvasTexture,
    NearestFilter,
    RepeatWrapping,
    Raycaster,
    Vector2,
    MeshPhysicalMaterial,
    FloatType,
    EquirectangularReflectionMapping,
} from 'three';
import { HDRLoader } from 'three/examples/jsm/Addons.js';
import Lego from './Lego';
import { PMREMGenerator } from 'three';
import CameraManager from './CameraManager';
import LightsManager from './LightsManager';

const GRID_SIZE = 101;

export default class SceneLego extends Scene {
    constructor(options = {}) {
        super();

        this.renderer = options.renderer;
        this.debugger = options.debugger;

        this.fog = this.createFog();
        this.debugFolder = this.createDebugFolder();
        this.cameraManager = this.createCameraManager();
        this.envmap = this.createEnvmap();
        this.legoMaterial = this.createLegoMaterial();
        this.lego = this.createLego();
        this.floorTexture = this.createFloorTexture();
        this.floor = this.createFloor();
        this.mouseGhost = this.createMouseGhost();
        this.raycaster = new Raycaster();
        this.mousePosition = new Vector2();
        this.mouseGridPosition = new Vector2();
        this.lightsManager = this.createLightsManager();

        this.setupEventListeners();
    }

    get camera() {
        return this.cameraManager.camera;
    }

    createCameraManager() {
        const cameraManager = new CameraManager({
            renderer: this.renderer,
            debugger: this.debugFolder,
        });

        return cameraManager;
    }

    createFog() {
        const fog = new Fog(0xffffff, 10, 50);

        this.fog = fog;

        return fog;
    }

    createLightsManager() {
        const lightsManager = new LightsManager({
            scene: this,
            renderer: this.renderer,
            debugger: this.debugFolder,
            cameraManager: this.cameraManager,
        });

        return lightsManager;
    }

    createLegoMaterial() {
        const material = new MeshPhysicalMaterial({
            color: 'red',
            clearcoat: 0.1,
            metalness: 0.1,
            clearcoatRoughness: 0.1,
        });

        return material;
    }

    createFloorTexture() {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        canvas.width = 2;
        canvas.height = 2;

        context.fillStyle = '#F1F1F1';
        context.fillRect(0, 0, 1, 1);
        context.fillRect(1, 1, 1, 1);

        context.fillStyle = '#BFBFBF';
        context.fillRect(1, 0, 1, 1);
        context.fillRect(0, 1, 1, 1);

        const canvasTexture = new CanvasTexture(canvas);
        canvasTexture.minFilter = NearestFilter;
        canvasTexture.magFilter = NearestFilter;
        canvasTexture.wrapS = RepeatWrapping;
        canvasTexture.wrapT = RepeatWrapping;
        canvasTexture.repeat.set(GRID_SIZE / 2, GRID_SIZE / 2);

        return canvasTexture;
    }

    createFloor() {
        const geometry = new PlaneGeometry(1, 1, 1);
        const material = new MeshBasicMaterial({ map: this.floorTexture });
        const mesh = new Mesh(geometry, material);

        mesh.scale.set(GRID_SIZE, GRID_SIZE, GRID_SIZE);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = -0.5;

        this.add(mesh);

        return mesh;
    }

    createMouseGhost() {
        const mouseGhostMesh = new Mesh(
            new BoxGeometry(1, 1, 1),
            new MeshBasicMaterial({ color: 'red', opacity: 0.1, transparent: true }),
        );

        mouseGhostMesh.material.depthTest = false;
        mouseGhostMesh.material.depthWrite = false;

        this.add(mouseGhostMesh);

        return mouseGhostMesh;
    }

    createLego() {
        const colors = [0xff0000, 0x0000ff, 0xffff00];
        const randomColorIndex = Math.floor(Math.random() * colors.length);
        const randomSize = Math.floor(Math.random() * 2) + 1;
        const orientation = Math.floor(Math.random() * 3);

        const lego = new Lego({
            color: colors[randomColorIndex],
            size: randomSize,
            orientation: orientation,
            altitude: this.altitude,
            material: this.legoMaterial.clone(),
        });

        this.add(lego);

        if (this.mouseGridPosition) {
            lego.position.x = this.mouseGridPosition.x;
            lego.position.z = this.mouseGridPosition.y;
        }

        return lego;
    }

    async createEnvmap() {
        const loader = new HDRLoader();
        loader.setDataType(FloatType);

        loader.load('/01.hdr', (texture) => {
            texture.mapping = EquirectangularReflectionMapping;
            const generator = new PMREMGenerator(this.renderer);
            this.environment = generator.fromEquirectangular(texture, null).texture;
            generator.dispose();
        });
    }

    raycast() {
        this.raycaster.setFromCamera(this.mousePosition, this.camera);
        const intersects = this.raycaster.intersectObject(this.floor, false);

        if (intersects.length > 0) {
            const x = intersects[0].point.x;
            const y = intersects[0].point.z;

            this.mouseGridPosition.x = Math.round(x);
            this.mouseGridPosition.y = Math.round(y);

            this.mouseGhost.position.x = this.mouseGridPosition.x;
            this.mouseGhost.position.z = this.mouseGridPosition.y;
        }
    }

    resize(width, height) {
        this.renderWidth = width;
        this.renderHeight = height;

        this.cameraManager.resize(width, height);
    }

    /**
     * Events
     */
    setupEventListeners() {
        window.addEventListener('keydown', this.keydownHandler.bind(this));
        window.addEventListener('pointerdown', this.pointerdownHandler.bind(this));
        window.addEventListener('pointerup', this.pointerupHandler.bind(this));
        window.addEventListener('mousemove', this.mousemoveHandler.bind(this));
    }

    keydownHandler() {
        // this.createLego();
    }

    pointerdownHandler(e) {
        this.isPointerDown = true;

        this.pointerStartPosition = {
            x: e.clientX,
            y: e.clientY,
        };
    }

    pointerupHandler(e) {
        this.isPointerDown = false;

        const x = e.clientX;
        const y = e.clientY;

        const distX = x - this.pointerStartPosition.x;
        const distY = y - this.pointerStartPosition.y;
        const dist = Math.sqrt(distX * distX + distY * distY);

        const threshold = 5;

        if (dist > threshold) return;

        this.createLego();
    }

    mousemoveHandler(e) {
        this.mousePosition.x = (e.clientX / this.renderWidth) * 2 - 1;
        this.mousePosition.y = -(e.clientY / this.renderHeight) * 2 + 1;

        this.raycast();
    }

    /**
     * Debug
     */
    createDebugFolder() {
        if (!this.debugger) return;

        const sceneFolder = this.debugger.addFolder({ title: 'Scene Lego' });

        const fogFolder = sceneFolder.addFolder({ title: 'Fog' });
        fogFolder.addBinding(this.fog, 'near', { min: 0, max: 100 });
        fogFolder.addBinding(this.fog, 'far', { min: 0, max: 100 });
        fogFolder.addBinding(this.fog, 'color');

        // const materialFolder = sceneFolder.addFolder({ title: 'Material' });
        // materialFolder.addBinding(this.legoMaterial, 'roughness');
        // materialFolder.addBinding(this.legoMaterial, 'metalness');
        // materialFolder.addBinding(this.legoMaterial, 'clearcoat');
        // materialFolder.addBinding(this.legoMaterial, 'clearcoatRoughness');

        return sceneFolder;
    }
}
