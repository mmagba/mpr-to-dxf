// app/api/process-mpr/route.js

import { NextResponse } from 'next/server';

export const runtime = 'nodejs'; // Ensure we're using the Node.js runtime

// Helper functions to parse the MPR content

/**
 * Parses the [001] section to extract variable definitions.
 * @param {string[]} lines - Array of lines from the MPR file.
 * @returns {Object} - An object mapping variable names to their values.
 */
function parseVariables(lines) {
    const variables = {};
    let in001Section = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.startsWith('[001')) {
            in001Section = true;
            continue;
        }

        if (in001Section) {
            if (
                line.startsWith('[') ||
                line.startsWith('<') ||
                line.startsWith('$') ||
                line === ''
            ) {
                // End of [001] section
                break;
            }

            // Match variable assignments like VAR="value"
            const varMatch = line.match(/(\w+)\s*=\s*"([^"]+)"/);
            if (varMatch) {
                const varName = varMatch[1];
                const varValue = varMatch[2];
                variables[varName] = varValue;
            }
        }
    }

    return variables;
}

/**
 * Finds and extracts the line parameters (x, y, z) from the MPR content.
 * @param {string} content - The entire MPR file content as a string.
 * @returns {Object} - An object containing x, y, z coordinates.
 */
function findLine(content) {
    const lines = content.split('\n');
    const params = { x: null, y: null, z: null };
    const variables = parseVariables(lines);

    // Debug: Log parsed variables
    console.log('Parsed Variables:', variables);

    // Parse $E sections to find X=, Y=, Z=
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('$E')) {
            // Parse next 10 lines or until another section
            for (let j = i + 1; j < Math.min(i + 11, lines.length); j++) {
                const currentLine = lines[j].trim();

                if (
                    currentLine.startsWith('$E') ||
                    currentLine.startsWith('[') ||
                    currentLine.startsWith('<') ||
                    currentLine === ''
                ) {
                    break;
                }

                // Match key=value (e.g., X=73 or Z=T)
                const keyValueMatch = currentLine.match(/^(\w+)\s*=\s*(.+)$/);
                if (keyValueMatch) {
                    const key = keyValueMatch[1].toLowerCase();
                    let value = keyValueMatch[2].trim();

                    // Remove any surrounding quotes
                    value = value.replace(/^"(.+)"$/, '$1');

                    // Substitute variable if necessary
                    if (variables[value] !== undefined) {
                        value = variables[value];
                    }

                    // Convert to float if possible
                    const numericValue = parseFloat(value);
                    if (isNaN(numericValue)) {
                        // Handle non-numeric values (optional: you can throw an error or skip)
                        console.warn(`Non-numeric value for ${key.toUpperCase()}:`, value);
                        continue;
                    }

                    if (key === 'x') {
                        params.x = numericValue;
                    } else if (key === 'y') {
                        params.y = numericValue;
                    } else if (key === 'z') {
                        params.z = numericValue;
                    }
                }
            }
            // Assuming we only need the first $E section for the line
            break;
        }
    }

    // Debug: Log extracted parameters
    console.log('Extracted Line Parameters:', params);

    if (Object.values(params).some((v) => v === null || isNaN(v))) {
        throw new Error('One or more parameters (x, y, z) were not found in the file.');
    }

    return params;
}

/**
 * Finds and extracts all circle parameters (XA, YA, DU) from the MPR content.
 * @param {string} content - The entire MPR file content as a string.
 * @returns {Array} - An array of circle objects with xa, ya, du properties.
 */
function findCircles(content) {
    const lines = content.split('\n');
    const circles = [];
    const variables = parseVariables(lines);

    // Debug: Log parsed variables for circles
    console.log('Parsed Variables for Circles:', variables);

    // Parse <102> sections to find XA=, YA=, DU=
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('<102')) {
            const circle = { xa: null, ya: null, du: null };

            // Parse next 15 lines or until another section
            for (let j = i + 1; j < Math.min(i + 16, lines.length); j++) {
                const currentLine = lines[j].trim();

                if (
                    currentLine.startsWith('<') ||
                    currentLine.startsWith('[') ||
                    currentLine.startsWith('$') ||
                    currentLine === ''
                ) {
                    break;
                }

                // Match key="value" (e.g., XA="40")
                const keyValueMatch = currentLine.match(/^(\w+)\s*=\s*"([^"]+)"/);
                if (keyValueMatch) {
                    const key = keyValueMatch[1].toLowerCase();
                    let value = keyValueMatch[2].trim();

                    // Substitute variable if necessary
                    if (variables[value] !== undefined) {
                        value = variables[value];
                    }

                    // Convert to float if possible
                    const numericValue = parseFloat(value);
                    if (isNaN(numericValue)) {
                        // Handle non-numeric values (optional: you can throw an error or skip)
                        console.warn(`Non-numeric value for ${key.toUpperCase()}:`, value);
                        continue;
                    }

                    if (key === 'xa') {
                        circle.xa = numericValue;
                    } else if (key === 'ya') {
                        circle.ya = numericValue;
                    } else if (key === 'du') {
                        circle.du = numericValue;
                    }
                }
            }

            // Only add circle if all parameters are found
            if (Object.values(circle).every((v) => v !== null && !isNaN(v))) {
                circles.push(circle);
            }

            // Continue searching for more <102> sections
        }
    }

    // Debug: Log extracted circles
    console.log('Extracted Circles:', circles);

    return circles;
}

/**
 * Generates the DXF content based on extracted line and circle parameters.
 * @param {Object} line - An object containing x, y, z coordinates.
 * @param {Array} circles - An array of circle objects with xa, ya, du properties.
 * @returns {string} - The DXF file content as a string.
 */
function createDxf(line, circles) {
    let dxf = '';
    // DXF file header
    dxf += '0\nSECTION\n2\nHEADER\n0\nENDSEC\n';
    dxf += '0\nSECTION\n2\nENTITIES\n';

    // Creating a line
    dxf += '0\nLINE\n';
    dxf += '8\n0\n'; // Layer
    dxf += '10\n0.0\n'; // Start X
    dxf += '20\n0.0\n'; // Start Y
    dxf += `30\n${line.z}\n`; // Start Z
    dxf += `11\n${line.x}\n`; // End X
    dxf += `21\n${line.y}\n`; // End Y
    dxf += `31\n${line.z}\n`; // End Z

    // Creating circles
    for (const circle of circles) {
        const radius = circle.du / 2.0;
        dxf += '0\nCIRCLE\n';
        dxf += '8\n0\n'; // Layer
        dxf += `10\n${circle.xa}\n`; // Center X
        dxf += `20\n${circle.ya}\n`; // Center Y
        dxf += '30\n0.0\n'; // Center Z
        dxf += `40\n${radius}\n`; // Radius
    }

    // Ending the DXF file
    dxf += '0\nENDSEC\n';
    dxf += '0\nEOF';

    return dxf;
}

export async function POST(request) {
    try {
        // Parse the incoming form data
        const formData = await request.formData();
        const file = formData.get('mprFile');

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        // Read the uploaded file content
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const mprContent = buffer.toString('utf8');

        // Debug: Log the MPR content (optional, remove in production)
        console.log('MPR Content:\n', mprContent);

        // Process the MPR content to extract line and circle data
        const line = findLine(mprContent);
        const circles = findCircles(mprContent);

        // Generate the DXF content
        const dxfContent = createDxf(line, circles);

        // Debug: Log the DXF content (optional, remove in production)
        console.log('DXF Content:\n', dxfContent);

        // Return the DXF content as a response
        return new NextResponse(dxfContent, {
            status: 200,
            headers: {
                'Content-Type': 'application/dxf',
                'Content-Disposition': 'attachment; filename="output.dxf"',
            },
        });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json(
            { error: error.message || 'Error processing the MPR file.' },
            { status: 500 }
        );
    }
}
