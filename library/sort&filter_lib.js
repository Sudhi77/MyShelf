
// ==========================================================================
// GLOBALS: Reusable Caching Instantiations to Prevent GC Pressure
// ==========================================================================
const stringCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

// ==========================================================================
// ALGORITHM: High-Performance Multi-Field Substring Search Engine
// ==========================================================================
export function searchDatabase(query, data, fields) {
    if (!query) return data;
    const trimmed = query.trim().toLowerCase();
    if (trimmed === "") return data;

    const result = [];
    const dataLength = data.length;
    const fieldsLength = fields.length;

    for (let i = 0; i < dataLength; i++) {
        const item = data[i];
        let matched = false;

        for (let j = 0; j < fieldsLength; j++) {
            const field = fields[j];
            const val = item[field];

            if (val === undefined || val === null) continue;

            if (Array.isArray(val)) {
                const arrLen = val.length;
                for (let k = 0; k < arrLen; k++) {
                    const element = val[k];
                    if (element !== undefined && element !== null) {
                        const str = typeof element === 'string' ? element.toLowerCase() : String(element).toLowerCase();
                        if (str.includes(trimmed)) {
                            matched = true;
                            break;
                        }
                    }
                }
            } else {
                const str = typeof val === 'string' ? val.toLowerCase() : String(val).toLowerCase();
                if (str.includes(trimmed)) {
                    matched = true;
                }
            }

            if (matched) break; 
        }

        if (matched) {
            result.push(item);
        }
    }
    return result;
}

// ==========================================================================
// ALGORITHM: Property Categorization Dropdown Tag Filtering Engine
// ==========================================================================
export function filterMoviesByProperty(movies, filterBy, filterTag) {
    if (!filterBy || !filterTag) return movies;
    return movies.filter(movie => {
        const val = movie[filterBy];
        if (Array.isArray(val)) return val.includes(filterTag);
        return val === filterTag;
    });
}

// ==========================================================================
// ALGORITHM: Ultra-Optimized Stable Schwartzian Sort Engine
// ==========================================================================
export function sortMovies(movieArray, sortBy, properties) {
    const length = movieArray.length;
    if (length <= 1) return movieArray;

    let propKey = '';
    let isNumeric = false;
    let isDescending = false;

    if (sortBy === 'name-asc') {
        propKey = 'name';
        isDescending = false;
    } else if (sortBy === 'name-desc') {
        propKey = 'name';
        isDescending = true;
    } else if (sortBy === 'rating-desc') {
        propKey = 'Rating';
        isNumeric = true;
        isDescending = true;
    } else if (sortBy === 'rating-asc') {
        propKey = 'Rating';
        isNumeric = true;
        isDescending = false;
    } else if (sortBy === 'year-desc') {
        propKey = 'Year';
        isNumeric = true;
        isDescending = true;
    } else if (sortBy === 'year-asc') {
        propKey = 'Year';
        isNumeric = true;
        isDescending = false;
    } else if (sortBy === 'watched-desc') {
        propKey = properties.find(p => p.toLowerCase() === 'watched year') || 'Watched Year';
        isNumeric = true;
        isDescending = true;
    } else if (sortBy === 'watched-asc') {
        propKey = properties.find(p => p.toLowerCase() === 'watched year') || 'Watched Year';
        isNumeric = true;
        isDescending = false;
    }

    const wrappers = new Array(length);

    if (isNumeric) {
        for (let i = 0; i < length; i++) {
            const movie = movieArray[i];
            let val = movie[propKey];
            if (Array.isArray(val)) val = val[0];

            const num = (val !== undefined && val !== null && val !== '') ? parseFloat(val) : NaN;
            wrappers[i] = { movie: movie, key: num };
        }

        wrappers.sort((a, b) => {
            const hasA = !isNaN(a.key);
            const hasB = !isNaN(b.key);
            if (!hasA && !hasB) return stringCollator.compare(a.movie.name || '', b.movie.name || '');
            if (!hasA) return 1;  
            if (!hasB) return -1;
            if (a.key === b.key) return stringCollator.compare(a.movie.name || '', b.movie.name || '');
            return isDescending ? b.key - a.key : a.key - b.key;
        });
    } else {
        for (let i = 0; i < length; i++) {
            const movie = movieArray[i];
            const val = movie[propKey];
            wrappers[i] = { movie: movie, key: val ? String(val) : '' };
        }

        if (isDescending) {
            wrappers.sort((a, b) => stringCollator.compare(b.key, a.key));
        } else {
            wrappers.sort((a, b) => stringCollator.compare(a.key, b.key));
        }
    }

    for (let i = 0; i < length; i++) {
        movieArray[i] = wrappers[i].movie;
    }

    return movieArray;
}
