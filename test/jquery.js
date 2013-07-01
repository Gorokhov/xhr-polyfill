describe('jquery', function(){

	it('should be ok', function(cb){

		jQuery
		.ajax({
			url: '//' + location.hostname + ':9877/data.json'
		})
		.done(function(response){
			expect(response).to.eql(["one", "two", "three"]);
		})
		.always(function(){
			cb();
		})
		;
					
	});


});