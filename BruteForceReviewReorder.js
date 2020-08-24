// ==UserScript==
// @name          Brute Force Review Reorder
// @namespace     https://www.wanikani.com
// @description   Sort reviews based on whether they have been passed, their type, and when they became available for review.
// @author        Devin Schaffer
// @version       1.0.1
// @include       https://www.wanikani.com/review/session
// @grant         none
// ==/UserScript==

(function($, wkof) {
	wkof.include('Apiv2');
    wkof.ready('Apiv2')
        .then(getAssignments)
        .then(updateReviewQueue);

	function getAssignments() {
        let assignment_filters = {immediately_available_for_review: true};

		return wkof.Apiv2.fetch_endpoint('assignments', {filters: assignment_filters});
	}

	function updateReviewQueue(assignments) {
        let assignmentData = assignments.data;

        // Sort each section so when combined they can be used to correctly sort the queue.
        let unpassedRadicals = assignmentData.filter((item) => typeof(item.data.passed_at) == "undefined" && item.data.subject_type == 'radical')
            .sort((a, b) => (a.data.available_at < b.data.available_at) ? -1 : 1);

        let unpassedKanji = assignmentData.filter((item) => typeof(item.data.passed_at) == "undefined" && item.data.subject_type == 'kanji')
            .sort((a, b) => (a.data.available_at < b.data.available_at) ? -1 : 1);

        let unpassedVocabulary = assignmentData.filter((item) => typeof(item.data.passed_at) == "undefined" && item.data.subject_type == 'vocabulary')
            .sort((a, b) => (a.data.available_at < b.data.available_at) ? -1 : 1);

        let remainder = assignmentData.filter((item) => typeof(item.data.passed_at) != "undefined")
            .sort((a, b) => (a.data.available_at < b.data.available_at) ? -1 : 1);

        let orderedAssignments = [...unpassedRadicals || [], ...unpassedKanji || [], ...unpassedVocabulary || [], ...remainder || []];

        // Get WK's list of reviews.
        let reviewQueue = $.jStorage.get('activeQueue').concat($.jStorage.get('reviewQueue'));

        // Sort WK's list based on the list created above.
        reviewQueue = reviewQueue.sort((a, b) => sortQueue(a, b, orderedAssignments));

		updateQueueState(reviewQueue);
	}

    function sortQueue(a, b, orderedAssignments) {
        let c = orderedAssignments.find(item => item.data.subject_id === a.id);
        let d = orderedAssignments.find(item => item.data.subject_id === b.id);

        if (orderedAssignments.indexOf(c) < orderedAssignments.indexOf(d)) {
            return -1;
        } else {
            return 1;
        }
    }

	function updateQueueState(queue) {
		let batchSize = 10;

		let activeQueue = queue.slice(0, batchSize);

        // Reverse it since subsequent items are taken from the end of the queue.
		let inactiveQueue = queue.slice(batchSize).reverse();

		$.jStorage.set('activeQueue', activeQueue);
		$.jStorage.set('reviewQueue', inactiveQueue);

		let newCurrentItem = activeQueue[0];
		let newItemType = getItemType(newCurrentItem);

		$.jStorage.set('questionType', newItemType);
		$.jStorage.set('currentItem', newCurrentItem);
	}

	// Basically WaniKani's code.
	function getItemType(item) {
		if (item.rad) {
			return 'meaning';
		}

		let itemReviewData = item.kan ? $.jStorage.get('k' + item.id) : $.jStorage.get('v' + item.id);

		if (itemReviewData === null || (typeof itemReviewData.mc === 'undefined' && typeof itemReviewData.rc === 'undefined')) {
			return ['meaning', 'reading'][Math.floor(2 * Math.random())];
		}

		if (itemReviewData.mc >= 1) {
			return 'reading';
		}

		return 'meaning'
	}

})(window.jQuery, window.wkof);