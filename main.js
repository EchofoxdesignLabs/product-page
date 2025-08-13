    import * as THREE from 'three';
    import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
    import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
    import { gsap } from 'gsap/gsap-core';
    import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
    import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
    import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
    import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
    import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
    import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';

    let scene, camera,renderer,controls,composer, renderPass, bokehPass;
    const clock = new THREE.Clock();
    // --- NEW VARIABLES FOR SCROLL NAVIGATION ---
    let productTargets = []; // This will store our individual product models
    let currentTargetIndex = 0; // Tracks which product we are looking at
    let isAnimating = false; // Prevents spamming the scroll animation
    const mouse = new THREE.Vector2(); // Stores normalized mouse coordinates
    let baseCameraPosition = new THREE.Vector3(); // Stores the initial camera position for parallax calculations
    const parallaxGroup = new THREE.Group();
    // --- DOM element references for the text overlay ---
    const textContainer = document.getElementById('text-container');
    const productCategory = document.getElementById('product-category');
    const productTitle = document.getElementById('product-title');
    const productDescription = document.getElementById('product-description');
    const productLink = document.getElementById('product-link');

    // --- NEW: State variable to control when scroll hijacking is active ---
    let isScrollHijackingActive = false;

    // POSTPROCESSING: three composers approach
    let composerOriginal, composerBlur, composerFinal;
    let blurBokehPass, blendPass;
    // Tunables (start conservative for subtle DOF)
    const APERTURE = 0.00018;   // small aperture -> subtle blur
    const MAXBLUR = 0.0002;     // small max blur radius
    const BLEND_STRENGTH = 0.1;
    const currentBlendStrength = 0.2;


    init();
    animate();
    function init()
    {
        scene = new THREE.Scene();
        camera     = new THREE.PerspectiveCamera(24, innerWidth/innerHeight, 0.01, 100000);
        camera.position.set(0, 0, 0);
        baseCameraPosition.copy(camera.position); // Store the base position for parallax
        


        //renderer
        renderer = new THREE.WebGLRenderer({antialias:true, alpha:true});
        renderer.setPixelRatio(devicePixelRatio);
        renderer.setSize(innerWidth, innerHeight);
        renderer.setClearColor(0x000000, 0);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.domElement.style.position = 'absolute';
        renderer.domElement.style.top      = '0';
        renderer.domElement.style.left     = '0';
        document.body.appendChild(renderer.domElement);
        controls = new OrbitControls(camera, renderer.domElement);


        controls.enableDamping = true;
        // Set the controls target to the model's position for intuitive rotation
        // -- TO LOCK THE CAMERA VIEW LATER --
        // After you confirm the view, uncomment the three lines below.
        controls.enableZoom = false;
        controls.enableRotate = false;
        controls.enablePan = false;
        //controls.target.set(0, 0, 0);
        //controls.update(); 

        

        //lighting
        // // Directional Light (updated position and rotation from screenshot)
        const dirLight = new THREE.DirectionalLight(0xffffff, 1);
        dirLight.position.set(100,140,40);
        dirLight.castShadow = false; // Enable shadows for this light
        dirLight.shadow.mapSize.width = 4096; // Increased resolution for crisper shadows
        dirLight.shadow.mapSize.height = 4096;
        // with PCFSoftShadowMap active on your renderer:
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        dirLight.shadow.radius = 20;
        dirLight.shadow.camera.near = 0.5;
        dirLight.shadow.camera.far = 400;
        // CORRECTED: Increased shadow camera frustum size to ensure it covers the model and ground
        dirLight.shadow.camera.left = -150;
        dirLight.shadow.camera.right = 150;
        dirLight.shadow.camera.top = 150;
        dirLight.shadow.camera.bottom = -150;
        dirLight.shadow.bias = -0.0001; // push the shadow map sample back onto the surface
        dirLight.shadow.normalBias = 0.05; // helps even out stretched shadows
        scene.add(dirLight);
        scene.add(dirLight.target);
        dirLight.target.position.set(50, 60, 20);

        const ambientLight = new THREE.AmbientLight(0xffffff, 2.2);
        scene.add(ambientLight);
        let model = null;
        const loader = new GLTFLoader();
        const loaderElement = document.getElementById('loader');
        loader.load(
            'assets/models/bakedfinal24.glb',
            (gltf) => {
                
                model = gltf.scene;  
                console.log(model," model");      
                model.position.set(0, 0, 0);
                model.scale.set(5, 5,5);
                // --- IMPORTANT: FINDING YOUR PRODUCTS ---
                // We traverse the loaded model to find the items you want to focus on.
                // Replace the names in the array below with the EXACT names of your product objects from your 3D modeling software (e.g., Blender).
                // 'cameraPosition': The EXACT position the camera MOVES to.
                const productsWithData = [
                { name: "Airfrens", targetOffset: new THREE.Vector3(-3.5, 0, 0), cameraPosition: new THREE.Vector3(5, 5, -55), category: "Web3", title: "Airfrens", description: "Social media web 3 dating app, build from scratch. A new way to connect with people who share your passions.", link: "#" },
                { name: "Kylabs", targetOffset: new THREE.Vector3(-5, 0, 2), cameraPosition: new THREE.Vector3(90, 5, -60), category: "Mobile App", title: "Kydlabs", description: "Built for the top performing DJs, Promoters, Venues, Festivals and Artists.", link: "#" },
                { name: "Cox", targetOffset: new THREE.Vector3(-3, 0, 1), cameraPosition: new THREE.Vector3(200, 5, -58), category: "Branding", title: "Cox & Kings", description: "A project focused on delivering high-quality digital experiences and interfaces.", link: "#" },
                { name: "Monitor", targetOffset: new THREE.Vector3(-5, -1.5, 0), cameraPosition: new THREE.Vector3(300, 5, -52), category: "Web App", title: "Stevie Awards", description: "Advanced monitoring solutions for complex systems, providing real-time data and insights.", link: "#" },
                { name: "Games", targetOffset: new THREE.Vector3(-5, 0, 0), cameraPosition: new THREE.Vector3(400, 5, -54), category: "Gaming", title: "Trails of Echos", description: "Interactive and engaging gaming experiences built with modern web technologies.", link: "#" },
                { name: "VR", targetOffset: new THREE.Vector3(-4, 0, 0), cameraPosition: new THREE.Vector3(500, 5, -50), category: "Gaming", title: "VR Defender", description: "A digital business card to share your contact information seamlessly.", link: "#" },
                //{ name: "Brand", targetOffset: new THREE.Vector3(0, 0, 2), cameraPosition: new THREE.Vector3(600, 10, -60), category: "Utility", title: "Brand", description: "Built for the top performing DJs, Promoters, Venues, Festivals and Artists.", link: "#" },
                { name: "Chewy", targetOffset: new THREE.Vector3(-6, 0, 2), cameraPosition: new THREE.Vector3(600, 5, -51), category: "Utility", title: "Chewy", description: "Built for the top performing DJs, Promoters, Venues, Festivals and Artists.", link: "#" },
            ];
                const productNames = productsWithData.map(p => p.name);;
                //console.log("Loaded model's children:");
                model.traverse((child) => {
                    console.log(child.name); // This log helps you find the correct names!
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        if(child.material)
                        {
                            const mats = Array.isArray(child.material) ? child.material : [child.material];
                            mats.forEach(mat => {
                                // If the material uses a baked color map
                                if (mat.map) {
                                mat.map.encoding = THREE.sRGBEncoding;                     // correct color space
                                mat.map.generateMipmaps = true;                           // enable mipmaps
                                mat.map.minFilter = THREE.LinearMipmapLinearFilter;       // good min filter
                                mat.map.magFilter = THREE.LinearFilter;                   // smooth magnification
                                mat.map.anisotropy = renderer.capabilities.getMaxAnisotropy(); // crisp at oblique angles
                                mat.map.needsUpdate = true;
                                }
                                // If you have emissiveMap / aoMap / etc handle similarly
                                if (mat.emissiveMap) { mat.emissiveMap.encoding = THREE.sRGBEncoding; mat.emissiveMap.anisotropy = renderer.capabilities.getMaxAnisotropy(); mat.emissiveMap.needsUpdate = true; }
                                mat.needsUpdate = true;
                            });
                        }
                    }
                    // If a child's name is in our list, add it to our targets array.
                    const productData = productsWithData.find(p => p.name === child.name);
                    if (productData) {
                        // Store the object and its offset together
                        productTargets.push({ object: child, ...productData });
                        
                    }
                });
                // It's better to sort them to ensure a consistent order
                // Sort based on the original array order to fix the scroll jumping issue.
                productTargets.sort((a, b) => productNames.indexOf(a.object.name) - productNames.indexOf(b.object.name));
                //console.log(productTargets,"productTargets");
                scene.add(model);
                
                // Hide the loader and set the initial camera position
                //loaderElement.style.display = 'none';
                if (productTargets.length > 0) {
                    focusCameraOnTarget(currentTargetIndex, 0); // Focus instantly on the first item
                } else {
                    console.error("Could not find any of the specified product models. Check the names.");
                    // Fallback: just look at the center if no products are found
                    camera.position.set(0, 5, 20);
                    controls.target.set(0, 0, 0);
                }
                
            },
            undefined,
            (error) => {
                console.error('Error loading glTF model:', error);
            }
        );
        initPostprocessing();
        // --- Intersection Observer Setup ---
        const observerOptions = {
        root: null, 
        rootMargin: '0px',
        threshold: 0.30
        };

        // --- MODIFIED: The observer callback now handles auto-centering ---
        const intersectionCallback = (entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // If the canvas is intersecting AND we haven't already taken control...
                if (!isScrollHijackingActive) {
                    // ...take control...
                    isScrollHijackingActive = true;
                    // ...and tell the browser to smoothly scroll the element to the center.
                    entry.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            } else {
                // If the canvas is no longer intersecting, release control.
                isScrollHijackingActive = false;
            }
        });
        };

        const observer = new IntersectionObserver(intersectionCallback, observerOptions);
        observer.observe(renderer.domElement);
        
        parallaxGroup.add(model);
        scene.add(parallaxGroup);

        
        // Tell the observer to start watching the renderer's canvas.
        observer.observe(renderer.domElement);
        //window.addEventListener('wheel', onWheel, { passive: false });
        // --- MODIFIED ---
        // Listen for the wheel event directly on the canvas, not the whole window.
        // The { passive: false } option is crucial to allow us to call event.preventDefault().
        renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
        window.addEventListener('resize', onResize);
        window.addEventListener('mousemove', onMouseMove); // Listener for the new parallax effect
    }

    /**
     * Updates the text content in the HTML and makes it visible.
     * @param {number} index The index of the product to display.
     */
    function updateTextContent(index) {
        if (!productTargets[index]) return;
        const { title,category, description, link } = productTargets[index];
        productTitle.textContent = title;
        productCategory.textContent = category;
        productDescription.textContent = description;
        productLink.href = link;
        textContainer.classList.add('is-visible');
    }

    // --- NEW: CAMERA ANIMATION FUNCTION ---
    function focusCameraOnTarget(targetIndex, duration = 1) { // Default duration of 1.2 seconds
        if (isAnimating && duration > 0) return;
        isAnimating = true;
        // Fade out the current text
        textContainer.classList.remove('is-visible');

        const { object, targetOffset,cameraPosition } = productTargets[targetIndex];
        const targetPosition = new THREE.Vector3();
        object.getWorldPosition(targetPosition);

        // --- APPLY THE OFFSET ---
        // The final camera target is the object's position plus its defined offset
        const finalTarget = new THREE.Vector3().addVectors(targetPosition,  targetOffset);
        const focusDistance = cameraPosition.distanceTo(finalTarget);
        console.log(cameraPosition," cameraOffset")
        // --- DUAL GSAP ANIMATION ---
        // Animate camera position and target simultaneously for a smooth, cinematic effect.
        const tl = gsap.timeline({
            onComplete: () => {  
                baseCameraPosition = cameraPosition;
                // After the camera move, fade in the new text
                if (duration > 0) {
                    
                    updateTextContent(targetIndex);
                    // We keep 'isAnimating' true for 800ms more to cover the text animation.
                    setTimeout(() => {
                        isAnimating = false;
                    }, 500); // This duration should match your CSS transition time
                    
                }
                else
                {
                    isAnimating = false;
                }
            }
        });

        tl.to(camera.position, {
            x: cameraPosition.x,
            y: cameraPosition.y,
            z: cameraPosition.z,
            duration: duration,
            ease: "power2.out"
        }, 0); // The '0' at the end makes it start at the same time as the next animation

        tl.to(controls.target, {
            x: finalTarget.x,
            y: finalTarget.y,
            z: finalTarget.z,
            duration: duration,
            ease: "power2.out"
        }, 0);
        // --- MODIFIED: Animate the focus property of the BokehPass ---
        tl.to(bokehPass.uniforms.focus, { value: focusDistance, duration: duration, ease: "power2.out" }, 0);

        // Handle the initial page load (no animation duration)
        if (duration === 0) {
            // Instantly set focus on initial load
            bokehPass.uniforms.focus.value = focusDistance;
            updateTextContent(targetIndex);
            isAnimating = false;
        }
    }
    // --- NEW: SCROLL HANDLING FUNCTION ---
    // function onWheel(event) {
    //     if (isAnimating || productTargets.length === 0) return; // Ignore scroll if an animation is playing

    //     // Determine scroll direction
    //     const scrollDirection = event.deltaY > 0 ? 1 : -1;

    //     currentTargetIndex += scrollDirection;

    //     // Loop back around if we go past the start or end
    //     if (currentTargetIndex >= productTargets.length) {
    //         currentTargetIndex = 0;
    //     } else if (currentTargetIndex < 0) {
    //         currentTargetIndex = productTargets.length - 1;
    //     }
        
    //     focusCameraOnTarget(currentTargetIndex);
    // }
    // --- MODIFIED: REWRITTEN SCROLL HANDLING LOGIC ---
    function onWheel(event) {
        // 1. Check if scroll hijacking should be active.
        // If the canvas isn't fully in view, do nothing and let the parent page scroll.
        if (!isScrollHijackingActive) {
            return;
        }
        // If there are no products to scroll to, do nothing.
        if (productTargets.length === 0) return;

        const scrollDirection = event.deltaY > 0 ? 1 : -1;

        // --- BOUNDARY CHECK ---
        // This is the core of the solution. We check if the user is at the
        // beginning and scrolling up, or at the end and scrolling down.
        const isAtFirstAndScrollingUp = (currentTargetIndex === 0 && scrollDirection === -1);
        const isAtLastAndScrollingDown = (currentTargetIndex === productTargets.length - 1 && scrollDirection === 1);

        if (isAtFirstAndScrollingUp || isAtLastAndScrollingDown) {
            // If we are at a boundary, we DON'T call event.preventDefault().
            // This allows the event to "bubble up" and scroll the main Framer page.
            // We simply return and do nothing to the Three.js scene.
            if(!isAnimating)
            return;
        }

        // --- CAPTURE THE SCROLL ---
        // If we are not at a boundary, we are "inside" the 3D experience.
        // We MUST prevent the default action to stop the main page from scrolling.
        event.preventDefault();

        // If an animation is already running, ignore this scroll event but
        // keep the page scroll prevented.
        if (isAnimating) return;

        // Update the index to move to the next or previous product.
        currentTargetIndex += scrollDirection;
        
        // Note: We no longer need the logic to "loop back around" because
        // we want the scroll to exit at the ends.

        // Trigger the animation to focus on the new target.
        focusCameraOnTarget(currentTargetIndex);
    }
    function onResize() {
        camera.aspect = innerWidth/innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(innerWidth, innerHeight);
        // --- MODIFIED: Resize the composer and its passes ---
        composer.setSize(innerWidth, innerHeight);
        if (bokehPass) {
            bokehPass.uniforms['width'].value = innerWidth;
            bokehPass.uniforms['height'].value = innerHeight;
        }
    }
    // This function updates the mouse coordinates for the parallax effect.
    function onMouseMove(event) {
        // Normalize mouse position from -1 to 1
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    function initPostprocessing() {
        // --- ADDED: Post-processing Setup ---
        composer = new EffectComposer(renderer);
        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);

        bokehPass = new BokehPass(scene, camera, {
            focus: 60.0,      
            aperture: 0.0005,  
            maxblur: 0.009,    
            width: innerWidth,
            height: innerHeight
        });
        composer.addPass(bokehPass);
        // --- ADDED: Anti-aliasing Pass ---
        // This pass smooths the jagged edges. It should come after your main effects
        // but before the final OutputPass.
        const smaaPass = new SMAAPass(innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio());
        composer.addPass(smaaPass);
        // --- ADDED: The Fix! ---
        // This pass corrects the color space, preventing the darkening effect.
        // It should always be the LAST pass in the chain.
        const outputPass = new OutputPass();
        composer.addPass(outputPass);
    }

    function animate()
    {
        requestAnimationFrame(animate);
        const t = clock.getElapsedTime();
        const deltaTime = clock.getDelta();

        if(!isAnimating)
        {
            // // 1) Parallax camera‐position shift (optional)
            const pf = 4;
            const targetX = baseCameraPosition.x + mouse.x * pf;
            const targetY = baseCameraPosition.y + mouse.y * pf;
            camera.position.x += (targetX - camera.position.x) * 0.05;
            camera.position.y += (targetY - camera.position.y) * 0.05;

            // 2) Tiny group rotations
            const pa = 1;
            const ty = mouse.x * pa, tx = mouse.y * pa;
            parallaxGroup.rotation.y += (ty - parallaxGroup.rotation.y) * 0.05;
            parallaxGroup.rotation.x += (tx - parallaxGroup.rotation.x) * 0.05;
        }

        
        
        
        // controls.update();
         //renderer.render(scene, camera);
        controls.update();
        composer.render(deltaTime);
        
    }